// File: js/kernel/kernel.js
import { eventBus } from '../eventBus.js';
import { syscalls } from './syscalls.js';
import { logger } from '../utils/logger.js';

const processList = new Map();
let nextPid = 1;

export const kernel = {
    async init() {
        logger.info('Kernel (Preemptive): Initializing...');
        // Nu mai înregistrăm syscall-uri aici, ele vor fi apelate direct
        eventBus.on('proc.exec', (params) => this.handleProcessExecution(params));
        eventBus.on('proc.kill', (params) => this.handleProcessKill(params));
        logger.info('Kernel (Preemptive): Initialization complete.');
        eventBus.emit('kernel.boot_complete');
    },

    async handleProcessExecution({ pipeline, onOutput, onExit, cwd }) {
        const pid = nextPid++;
        
        // În viitor, poți gestiona pipeline-uri mai complexe aici.
        // Pentru moment, ne concentrăm pe un singur proces.
        const procInfo = pipeline[0];

        const worker = new Worker('/js/kernel/worker-process.js', { type: 'module' });

        const process = {
            pid,
            worker,
            onOutput,
            onExit,
            name: procInfo.name,
            status: 'RUNNING'
        };
        processList.set(pid, process);

        worker.onmessage = async (e) => {
            const { type, payload } = e.data;

            switch (type) {
                case 'syscall': {
                    const { name, params, callId } = payload;
                    try {
                        const result = await syscalls[name](params);
                        worker.postMessage({ type: 'syscall_result', payload: { result, callId } });
                    } catch (error) {
                        worker.postMessage({ type: 'syscall_error', payload: { error: error.message, callId } });
                    }
                    break;
                }
                case 'stdout':
                    onOutput(payload.data);
                    break;
                case 'exit':
                    onExit(payload.exitCode);
                    worker.terminate();
                    processList.delete(pid);
                    break;
                case 'error':
                     onOutput({ type: 'error', message: payload.message });
                     break;
            }
        };

        worker.onerror = (e) => {
            onOutput({ type: 'error', message: `Process ${pid} error: ${e.message}` });
            onExit(1);
            processList.delete(pid);
        };
        
        // Trimitem informațiile necesare pentru ca worker-ul să pornească procesul
        worker.postMessage({
            type: 'init',
            payload: {
                procInfo,
                cwd,
                pid
                // stdin-ul pentru pipeline-uri ar fi gestionat aici
            }
        });
    },

    handleProcessKill({ pid, resolve, reject }) {
        const pidToKill = parseInt(pid, 10);
        const process = processList.get(pidToKill);

        if (process) {
            process.worker.terminate();
            process.onExit(1); // Notifică shell-ul
            processList.delete(pidToKill);
            if (resolve) resolve();
        } else {
            if (reject) reject(new Error(`kill: Process with PID ${pidToKill} not found.`));
        }
    }
};