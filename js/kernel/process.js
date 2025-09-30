// File: js/kernel/process.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

let nextPid = 1;
const processList = new Map();

export const processManager = {
    createAndRun: async ({ pipeline, onOutput, onExit, cwd }) => {
        if (!pipeline || pipeline.length === 0) {
            onExit(0);
            return;
        }

        const proc = pipeline[0];
        const pid = nextPid++;
        const process = { pid, name: proc.name, status: 'running' };
        processList.set(pid, process);

        try {
            // Se importă dinamic fișierul comenzii
            const module = await import(`/js/bin/${proc.name}.js`);
            
            // Se verifică dacă funcția `logic` este exportată
            const logic = module.logic;

            if (typeof logic !== 'function') {
                throw new Error(`Command '${proc.name}' logic is not a valid function.`);
            }

            const stdout = { write: (data) => onOutput(data) };
            const context = { cwd, stdout };

            const exitCode = await logic({ args: proc.args, onOutput, cwd });
            process.status = 'exited';
            onExit(exitCode);
        } catch (e) {
            process.status = 'crashed';
            onOutput({ type: 'error', message: e.message });
            onExit(1);
        }
    },

    listProcesses: () => Array.from(processList.values()),
};