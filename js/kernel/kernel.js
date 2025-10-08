// File: js/kernel/kernel.js
import { eventBus } from '../eventBus.js';
import { syscalls } from './syscalls.js';
import { logger } from '../utils/logger.js';
import { resolvePath } from '../utils/path.js';

// --- State-ul Kernel-ului (variabile private la nivel de modul) ---
const processList = new Map();
const processHistory = [];
let nextPid = 1;

// --- Funcții Helper Private ---

/**
 * Gestionează o cerere de syscall, direcționând-o către handler-ul corect.
 * @param {string} name - Numele syscall-ului (ex: 'vfs.readFile').
 * @param {object} params - Parametrii pentru syscall.
 * @returns {Promise<any>} Rezultatul syscall-ului.
 */
async function _handleSyscallRequest(name, params) {
    // 1. Syscall-uri gestionate direct de Kernel (cele care au nevoie de acces la starea internă)
    if (name === 'proc.list') {
        return Array.from(processList.values()).map(p => ({ pid: p.pid, name: p.name, status: p.status }));
    }
    if (name === 'proc.history') {
        return processHistory;
    }

    // 2. Syscall-uri standard, definite în syscalls.js
    if (syscalls.hasOwnProperty(name)) {
        return syscalls[name](params);
    }
    
    // 3. Syscall-uri bazate pe servicii (evenimente), pentru module decuplate (ex: shell.get_history)
    return new Promise((resolve, reject) => {
        eventBus.emit(`syscall.${name}`, { ...params, resolve, reject });
    });
}

/**
 * Curăță resursele asociate unui proces terminat.
 * @param {object} process - Obiectul procesului de terminat.
 * @param {string} status - Noul status ('TERMINATED' sau 'KILLED').
 * @param {number} exitCode - Codul de ieșire.
 */
function _terminateProcess(process, status, exitCode) {
    if (!process) return;

    process.worker.terminate();
    processList.delete(process.pid);

    const historyEntry = process.historyEntry;
    if (historyEntry) {
        historyEntry.status = status;
        historyEntry.endTime = new Date();
        historyEntry.exitCode = exitCode;
    }
}

// --- Obiectul Principal Kernel ---

export const kernel = {
    async init() {
        logger.info('Kernel (Preemptive): Initializing...');
        eventBus.on('proc.exec', (params) => this.handleProcessExecution(params));
        // Am simplificat 'proc.kill' pentru a folosi direct _terminateProcess
        eventBus.on('proc.kill', ({ pid, resolve, reject }) => {
            const process = processList.get(parseInt(pid, 10));
            if (process) {
                _terminateProcess(process, 'KILLED', 143);
                process.onExit(1); // Notifică shell-ul că procesul s-a încheiat brusc
                resolve();
            } else {
                reject(new Error(`kill: Process with PID ${pid} not found.`));
            }
        });
        logger.info('Kernel (Preemptive): Initialization complete.');
        eventBus.emit('kernel.boot_complete');
    },

    /**
     * Punctul de intrare pentru execuția unui pipeline de comenzi.
     */
    async handleProcessExecution({ pipeline, onOutput, onExit, cwd }) {
        this._runPipelineStage(pipeline, onOutput, onExit, cwd, null);
    },

    /**
     * Execută un singur stagiu dintr-un pipeline.
     * La finalizare, va apela recursiv următorul stagiu dacă este necesar (pipe).
     */
    _runPipelineStage(pipeline, finalOnOutput, finalOnExit, cwd, stdin) {
        if (!pipeline || pipeline.length === 0) {
            finalOnExit(0);
            return;
        }

        const procInfo = pipeline[0];
        const remainingPipeline = pipeline.slice(1);
        const pid = nextPid++;
        
        let outputBuffer = '';
        const worker = new Worker('/js/kernel/worker-process.js', { type: 'module' });

        const historyEntry = {
            pid, name: procInfo.name, status: 'RUNNING',
            startTime: new Date(), endTime: null, exitCode: null,
        };
        processHistory.push(historyEntry);

        const process = {
            pid, worker, name: procInfo.name, status: 'RUNNING',
            onExit: finalOnExit, historyEntry,
        };
        processList.set(pid, process);

        worker.onmessage = async (e) => {
            const { type, payload } = e.data;

            switch (type) {
                case 'syscall':
                    try {
                        const result = await _handleSyscallRequest(payload.name, payload.params);
                        worker.postMessage({ type: 'syscall_result', payload: { result, callId: payload.callId } });
                    } catch (error) {
                        worker.postMessage({ type: 'syscall_error', payload: { error: error.message || 'Syscall failed', callId: payload.callId } });
                    }
                    break;

                case 'stdout':
                    const message = payload.data.message ?? '';
                    if (procInfo.stdout === 'pipe' || procInfo.stdout === 'file') {
                        outputBuffer += message + (message.endsWith('\n') ? '' : '\n');
                    } else {
                        finalOnOutput(payload.data);
                    }
                    break;

                case 'exit':
                    _terminateProcess(process, 'TERMINATED', payload.exitCode);

                    if (procInfo.stdout === 'pipe') {
                        this._runPipelineStage(remainingPipeline, finalOnOutput, finalOnExit, cwd, outputBuffer.replace(/\n$/, ''));
                    } else if (procInfo.stdout === 'file') {
                        this._handleFileRedirect(procInfo, cwd, outputBuffer, finalOnOutput, finalOnExit);
                    } else {
                        finalOnExit(payload.exitCode);
                    }
                    break;
                
                case 'error':
                    finalOnOutput({ type: 'error', message: payload.message });
                    break;
            }
        };

        worker.onerror = (e) => {
            finalOnOutput({ type: 'error', message: `Process ${pid} error: ${e.message}` });
            _terminateProcess(process, 'CRASHED', 1);
            finalOnExit(1);
        };
        
        worker.postMessage({ type: 'init', payload: { procInfo, cwd, pid, stdin } });
    },

    /**
     * Gestionează logica de scriere în fișier pentru redirectări ('>' și '>>').
     */
    async _handleFileRedirect(procInfo, cwd, buffer, onOutput, onExit) {
        try {
            let content = buffer.replace(/\n$/, '');
            if (procInfo.append) {
                // Aici am putea adăuga o verificare dacă fișierul există și nu e gol
                // pentru a adăuga newline, dar pentru simplitate, îl adăugăm mereu.
                content = '\n' + content;
            }
            await syscalls['vfs.writeFile']({
                path: resolvePath(cwd, procInfo.outputFile),
                content: content,
                append: procInfo.append
            });
            onExit(0);
        } catch (e) {
            onOutput({ message: e.message, isError: true });
            onExit(1);
        }
    }
};