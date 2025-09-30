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
            // Asigură-te că fișierul din disc se numește "ls.js"
            const module = await import(`/js/bin/${proc.name}.js`);
            const logic = module.default;

            const stdout = { write: (data) => onOutput(data) };
            const context = { cwd, stdout };

            const exitCode = await logic(proc.args, context);
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