// File: js/kernel/kernel.js (Versiune finală, cu suport complet pentru 'kill')
import { eventBus } from '../eventBus.js';
import { syscalls } from './syscalls.js';
import { logger } from '../utils/logger.js';
import { resolvePath } from '../utils/path.js';

// --- State-ul Kernel-ului (variabile private la nivel de modul) ---
const processList = new Map();
const processHistory = [];
let nextPid = 1;

// --- Funcții Helper Private ---

async function _handleSyscallRequest(name, params) {
    if (name === 'proc.list') {
        return Array.from(processList.values()).map(p => ({ pid: p.pid, name: p.name, status: p.status }));
    }
    if (name === 'proc.history') {
        return processHistory;
    }

    if (syscalls.hasOwnProperty(name)) {
        return syscalls[name](params);
    }
    
    return new Promise((resolve, reject) => {
        eventBus.emit(`syscall.${name}`, { ...params, resolve, reject });
    });
}

function _terminateWorkerProcess(process) {
    if (!process || !process.worker) return;
    process.worker.terminate();
}

// --- Obiectul Principal Kernel ---
export const kernel = {
    async init() {
        logger.info('Kernel (Preemptive): Initializing...');
        eventBus.on('proc.exec', (params) => this.handleProcessExecution(params));
        
        // ==========================================================
        // AICI ESTE NOUA LOGICĂ ACTUALIZATĂ PENTRU 'proc.kill'
        // ==========================================================
        eventBus.on('proc.kill', ({ pid, resolve, reject }) => {
            const pidToKill = parseInt(pid, 10);
            const process = processList.get(pidToKill);

            if (!process) {
                return reject(new Error(`kill: Process with PID ${pidToKill} not found.`));
            }

            logger.info(`Kernel: Received kill signal for PID ${pidToKill}`);

            // Actualizăm starea în istoric
            if (process.historyEntry) {
                process.historyEntry.status = 'KILLED';
                process.historyEntry.endTime = new Date();
                process.historyEntry.exitCode = 143; // Cod standard pentru SIGTERM
            }
            
            // Verificăm tipul procesului
            if (process.worker) {
                // Proces de tip Web Worker
                _terminateWorkerProcess(process);
                if (process.onExit) process.onExit(1); // Notifică shell-ul dacă e cazul
            } else {
                // Proces de pe Main Thread (UI)
                eventBus.emit('proc.terminate_main', { pid: pidToKill });
            }

            // Scoatem procesul din lista de procese active
            processList.delete(pidToKill);
            resolve();
        });
        
        logger.info('Kernel (Preemptive): Initialization complete.');
        eventBus.emit('kernel.boot_complete');
    },
    
    async handleProcessExecution({ pipeline, onOutput, onExit, cwd }) {
        const procInfo = pipeline[0];
        
        if (procInfo.runOn === 'main') {
            await this._runMainThreadProcess(procInfo, onOutput, onExit, cwd);
        } else {
            this._runPipelineStage(pipeline, onOutput, onExit, cwd, null);
        }
    },

    async _runMainThreadProcess(procInfo, onOutput, onExit, cwd) {
        const pid = nextPid++;
        logger.info(`Kernel: Launching main-thread process '${procInfo.name}' with PID ${pid}`);

        const historyEntry = {
            pid, name: procInfo.name, status: 'RUNNING',
            startTime: new Date(), endTime: null, exitCode: null,
        };
        processHistory.push(historyEntry);

        const process = {
            pid, worker: null,
            name: procInfo.name, status: 'RUNNING',
            onExit: onExit || (() => {}), 
            historyEntry,
        };
        processList.set(pid, process);

        try {
            const module = await import(`/js/system/${procInfo.name}.js`);
            if (!module.process || typeof module.process.start !== 'function') {
                throw new Error(`Main-thread process '${procInfo.name}' is invalid.`);
            }
            await module.process.start({ pid, args: procInfo.args, cwd });
        } catch (error) {
            logger.error(`Failed to start main-thread process '${procInfo.name}': ${error.message}`);
            historyEntry.status = 'CRASHED';
            historyEntry.exitCode = 1;
            processList.delete(pid);
            if (onOutput) onOutput({ message: error.message, isError: true });
            if (onExit) onExit(1);
        }
    },

    _runPipelineStage(pipeline, finalOnOutput, finalOnExit, cwd, stdin) {
        if (!pipeline || pipeline.length === 0) {
            if (finalOnExit) finalOnExit(0);
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
                    processList.delete(pid);
                    if(historyEntry){
                        historyEntry.status = 'TERMINATED';
                        historyEntry.endTime = new Date();
                        historyEntry.exitCode = payload.exitCode;
                    }

                    if (procInfo.stdout === 'pipe') {
                        this._runPipelineStage(remainingPipeline, finalOnOutput, finalOnExit, cwd, outputBuffer.replace(/\n$/, ''));
                    } else if (procInfo.stdout === 'file') {
                        this._handleFileRedirect(procInfo, cwd, outputBuffer, finalOnOutput, finalOnExit);
                    } else {
                        if (finalOnExit) finalOnExit(payload.exitCode);
                    }
                    break;
                case 'error':
                    finalOnOutput({ type: 'error', message: payload.message });
                    break;
            }
        };

        worker.onerror = (e) => {
            finalOnOutput({ type: 'error', message: `Process ${pid} error: ${e.message}` });
            _terminateWorkerProcess(process);
            processList.delete(pid);
            if(historyEntry) {
                historyEntry.status = 'CRASHED';
                historyEntry.endTime = new Date();
                historyEntry.exitCode = 1;
            }
            if (finalOnExit) finalOnExit(1);
        };
        
        worker.postMessage({ type: 'init', payload: { procInfo, cwd, pid, stdin } });
    },

    async _handleFileRedirect(procInfo, cwd, buffer, onOutput, onExit) {
        try {
            let content = buffer.replace(/\n$/, '');
            if (procInfo.append) {
                content = '\n' + content;
            }
            await syscalls['vfs.writeFile']({
                path: resolvePath(cwd, procInfo.outputFile),
                content: content,
                append: procInfo.append
            });
            if (onExit) onExit(0);
        } catch (e) {
            onOutput({ message: e.message, isError: true });
            if (onExit) onExit(1);
        }
    }
};