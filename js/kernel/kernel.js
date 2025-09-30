// File: js/kernel/kernel.js
import { eventBus } from '../eventBuss.js';
import { syscalls } from './syscalls.js';
import { processManager } from './process.js';
import { logger } from '../utils/logger.js';

export const kernel = {
    async init() {
        logger.info('Kernel: Initializing...');
        this.registerSyscalls();
        eventBus.on('proc.exec', this.handleProcessExecution);
        logger.info('Kernel: Initialization complete.');
        eventBus.emit('kernel.boot_complete');
    },

    registerSyscalls() {
        for (const name in syscalls) {
            eventBus.on(`syscall.${name}`, async (params) => {
                const { resolve, reject, ...rest } = params;
                try {
                    const result = await syscalls[name](rest);
                    resolve(result);
                } catch (e) {
                    reject(e);
                }
            });
        }
    },
    
    handleProcessExecution(params) {
        processManager.createAndRun(params);
    }
};