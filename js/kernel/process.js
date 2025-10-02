// File: js/kernel/process.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from './syscalls.js';

let nextPid = 1;
const processList = new Map();

export const processManager = {
    createAndRun: async ({ pipeline, onOutput, onExit, cwd }) => {
        let inputData = null; // Va stoca ieșirea comenzii anterioare (stdin pentru următoarea)

        for (let i = 0; i < pipeline.length; i++) {
            const proc = pipeline[i];
            const isLastCommand = i === pipeline.length - 1;

            const pid = nextPid++;
            const process = { pid, name: proc.name, status: 'running' };
            processList.set(pid, process);

            try {
                const module = await import(`/js/bin/${proc.name}.js`);
                const logic = module.logic;

                if (typeof logic !== 'function') {
                    throw new Error(`Command '${proc.name}' logic is not a valid function.`);
                }

                let outputBuffer = '';
                
                const commandOnOutput = (data) => {
                    const message = (typeof data === 'string') ? data : data.message;
                    if (proc.stdout === 'pipe' || proc.stdout === 'file') {
                        outputBuffer += message + '\n';
                    } else {
                        onOutput(data);
                    }
                };
                
                // --- MODIFICARE CHEIE ---
                // Datele din pipe sunt pasate prin `stdin`, nu adăugate la `args`.
                const exitCode = await logic({
                    args: proc.args,
                    onOutput: commandOnOutput,
                    cwd,
                    stdin: inputData // `inputData` conține ieșirea comenzii anterioare
                });

                if (proc.stdout === 'file' && proc.outputFile) {
                    await syscall('vfs.writeFile', {
                        path: proc.outputFile,
                        content: outputBuffer,
                        append: proc.append
                    });
                }
                
                if (outputBuffer.endsWith('\n')) {
                    inputData = outputBuffer.slice(0, -1);
                } else {
                    inputData = outputBuffer;
                }

                process.status = 'exited';
                if (isLastCommand) {
                    onExit(exitCode);
                }

            } catch (e) {
                process.status = 'crashed';
                onOutput({ type: 'error', message: e.message });
                if (isLastCommand) {
                    onExit(1);
                }
                return; 
            }
        }
    },

    listProcesses: () => Array.from(processList.values()),
};