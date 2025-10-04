// File: js/kernel/process.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from './syscalls.js';

const QUANTUM = 10;
const SCHEDULER_INTERVAL = 10;

let nextPid = 1;
const processList = new Map();
const readyQueue = [];
let schedulerRunning = false;

class Process {
    constructor({ procInfo, onOutput, onExit, cwd, stdin = null }) {
        this.pid = nextPid++;
        this.name = procInfo.name;
        this.status = 'READY';
        this.onOutput = onOutput;
        this.onExit = onExit;
        this.cwd = cwd;
        this.procInfo = procInfo;
        this.outputBuffer = '';
        this.iterator = procInfo.logic({
            args: procInfo.args,
            cwd,
            stdin
        });
    }
}

async function schedule() {
    if (readyQueue.length === 0) {
        schedulerRunning = false;
        return;
    }

    setTimeout(schedule, SCHEDULER_INTERVAL);
    schedulerRunning = true;

    const process = readyQueue.shift();
    if (!process || process.status === 'TERMINATED') {
        return;
    }

    process.status = 'RUNNING';

    for (let i = 0; i < QUANTUM; i++) {
        let result;
        try {
            // Pasul 1: Obținem următoarea acțiune de la proces
            result = await process.iterator.next();
        } catch (e) {
            process.onOutput({ type: 'error', message: e.message });
            process.status = 'TERMINATED';
            process.onExit(1);
            processList.delete(process.pid);
            return;
        }

        // --- BLOCUL CRITIC DE CORECȚIE ---
        // Pasul 2: Dacă acțiunea este un syscall, îl executăm și suprascriem 'result'
        // cu acțiunea pe care procesul o execută IMEDIAT DUPĂ ce primește răspunsul.
        if (result.value && result.value.type === 'syscall') {
            try {
                const syscallResult = await syscall(result.value.name, result.value.params);
                result = await process.iterator.next(syscallResult);
            } catch (e) {
                process.onOutput({ type: 'error', message: e.message });
                process.status = 'TERMINATED';
                process.onExit(1);
                processList.delete(process.pid);
                return;
            }
        }
        // --- SFÂRȘIT BLOC CORECȚIE ---

        const { value, done } = result;

        // Pasul 3: Procesăm 'result', care acum este garantat a fi o acțiune post-syscall (dacă a fost cazul)
        if (done) {
            process.status = 'TERMINATED';
            const nextProcInfo = process.procInfo.next;

            if (process.procInfo.stdout === 'file') {
                try {
                    const content = process.outputBuffer.endsWith('\n') ? process.outputBuffer.slice(0, -1) : process.outputBuffer;
                    await syscall('vfs.writeFile', {
                        path: process.procInfo.outputFile,
                        content: content,
                        append: process.procInfo.append,
                        cwd: process.cwd
                    });
                } catch (e) {
                    process.onOutput({ type: 'error', message: e.message });
                    process.onExit(1);
                    processList.delete(process.pid);
                    return;
                }
            }

            if (nextProcInfo) {
                try {
                    const content = process.outputBuffer.endsWith('\n') ? process.outputBuffer.slice(0, -1) : process.outputBuffer;
                    const module = await import(`/js/bin/${nextProcInfo.name}.js`);
                    nextProcInfo.logic = module.logic;

                    const nextProcess = new Process({
                        procInfo: nextProcInfo,
                        onOutput: process.onOutput,
                        onExit: process.onExit,
                        cwd: process.cwd,
                        stdin: content
                    });
                    processList.set(nextProcess.pid, nextProcess);
                    readyQueue.push(nextProcess);
                } catch(e) {
                     process.onOutput({ type: 'error', message: e.message });
                     process.onExit(1);
                }
            } else {
                process.onExit(0);
            }

            processList.delete(process.pid);
            break; 
        }

        if (value && value.type === 'stdout') {
            const message = value.data.message ?? '';
            switch (process.procInfo.stdout) {
                case 'pipe':
                case 'file':
                    process.outputBuffer += message + '\n';
                    break;
                default: // 'terminal'
                    process.onOutput(value.data);
                    break;
            }
        }
    }

    if (process.status !== 'TERMINATED') {
        process.status = 'READY';
        readyQueue.push(process);
    }
}

export const processManager = {
    createAndRun: async ({ pipeline, onOutput, onExit, cwd }) => {
        if (!pipeline || pipeline.length === 0) {
            onExit(0);
            return;
        }

        for (let i = 0; i < pipeline.length - 1; i++) {
            pipeline[i].next = pipeline[i + 1];
        }

        try {
            const firstProcInfo = pipeline[0];
            const module = await import(`/js/bin/${firstProcInfo.name}.js`);
            if (typeof module.logic !== 'function' || module.logic.constructor.name !== 'GeneratorFunction') {
                throw new Error(`Command '${firstProcInfo.name}' logic is not a valid generator function.`);
            }
            firstProcInfo.logic = module.logic;

            const process = new Process({
                procInfo: firstProcInfo,
                onOutput,
                onExit,
                cwd,
                stdin: null
            });
            
            processList.set(process.pid, process);
            readyQueue.push(process);

            if (!schedulerRunning) {
                schedule();
            }
        } catch (e) {
            onOutput({ type: 'error', message: e.message });
            onExit(1);
        }
    },

    listProcesses: () => Array.from(processList.values()),
};