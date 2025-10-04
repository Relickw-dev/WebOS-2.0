// File: js/kernel/kernel.js
import { eventBus } from '../eventBus.js';
import { syscalls } from './syscalls.js';
import { processManager } from './process.js';
import { logger } from '../utils/logger.js';

export const kernel = {
    async init() {
        logger.info('Kernel: Initializing...');
        this.registerSyscalls();
        eventBus.on('proc.exec', this.handleProcessExecution); // handleProcessExecution este deja legat de 'this'
        logger.info('Kernel: Initialization complete.');
        eventBus.emit('kernel.boot_complete');
    },

    registerSyscalls() {
        for (const name in syscalls) {
            // Syscall-urile sunt acum apelate direct din process.js, 
            // dar păstrăm acest mecanism pentru eventuală compatibilitate inversă
            // sau alte tipuri de evenimente.
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
    
    // Funcția este acum asincronă pentru a se potrivi cu importurile dinamice
    async handleProcessExecution(params) {
        await processManager.createAndRun(params);
    }
};