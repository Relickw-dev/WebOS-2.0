// File: js/kernel/kernel.js
import { eventBus } from '../eventBus.js';
import { syscalls } from './syscalls.js';
import { logger } from '../utils/logger.js';
import { resolvePath } from '../utils/path.js';

// ==========================================================
// 🧠 Kernel State (Private Module Scope)
// ==========================================================
const processList = new Map();
const processHistory = [];
let nextPid = 1;

// ==========================================================
// ⚙️ Internal Helpers
// ==========================================================

/**
 * Handle syscall requests — some handled internally, others delegated to eventBus.
 */
async function _handleSyscallRequest(name, params) {
  try {
    switch (name) {
      case 'proc.list':
        return Array.from(processList.values()).map(p => ({
          pid: p.pid,
          name: p.name,
          status: p.status
        }));

      case 'proc.history':
        return processHistory;

      default:
        // Delegate syscall to its respective handler (e.g., vfs.*, net.*, etc.)
        return await new Promise((resolve, reject) => {
          eventBus.emit(name, { ...params, resolve, reject });
        });
    }
  } catch (err) {
    logger.error(`Syscall ${name} failed: ${err?.message || err}`);
    throw err;
  }
}

/** Terminate a worker process safely. */
function _terminateWorkerProcess(proc) {
  if (proc?.worker) {
    try {
      proc.worker.terminate();
    } catch (e) {
      logger.warn(`Failed to terminate worker PID ${proc.pid}: ${e.message}`);
    }
  }
}

// ==========================================================
// 🧩 Kernel Object Definition
// ==========================================================
export const kernel = {
  // --------------------------------------------------------
  // 🧭 Initialization
  // --------------------------------------------------------
  async init() {
    logger.info('Kernel: Initializing (Preemptive Mode)...');

    eventBus.on('proc.exec', (params) => this.handleProcessExecution(params));
    eventBus.on('proc.kill', (data) => this._handleKillRequest(data));

    logger.info('Kernel: Initialization complete.');
    eventBus.emit('kernel.boot_complete');
  },

  // --------------------------------------------------------
  // 💀 Process Termination Handler
  // --------------------------------------------------------
  async _handleKillRequest({ pid, resolve, reject }) {
    const pidToKill = parseInt(pid, 10);
    const process = processList.get(pidToKill);

    if (!process) {
      const msg = `kill: Process with PID ${pidToKill} not found.`;
      logger.warn(msg);
      return reject(new Error(msg));
    }

    logger.info(`Kernel: Received kill signal for PID ${pidToKill}`);

    const entry = process.historyEntry;
    if (entry) {
      entry.status = 'KILLED';
      entry.endTime = new Date();
      entry.exitCode = 143;
    }

    try {
      if (process.worker) {
        _terminateWorkerProcess(process);
        process.onExit?.(1);
      } else {
        eventBus.emit('proc.terminate_main', { pid: pidToKill });
      }

      processList.delete(pidToKill);
      resolve();
    } catch (err) {
      logger.error(`Kernel: Error while killing PID ${pidToKill}: ${err.message}`);
      reject(err);
    }
  },

  // --------------------------------------------------------
  // 🏃‍♂️ Process Execution Entry Point
  // --------------------------------------------------------
  // MODIFICARE: Adăugăm `user` în parametrii destructurați
  async handleProcessExecution({ pipeline, onOutput, onExit, cwd, user }) {
    if (!Array.isArray(pipeline) || !pipeline.length) {
      logger.warn('Kernel: Received empty pipeline.');
      onExit?.(0);
      return;
    }

    const procInfo = pipeline[0];
    if (procInfo.runOn === 'main') {
      await this._runMainThreadProcess(procInfo, onOutput, onExit, cwd);
    } else {
      // MODIFICARE: Pasăm `user` mai departe către _runPipelineStage
      this._runPipelineStage(pipeline, onOutput, onExit, cwd, user, null);
    }
  },

  // --------------------------------------------------------
  // 🧩 Run a Main Thread Process
  // --------------------------------------------------------
  async _runMainThreadProcess(procInfo, onOutput, onExit, cwd) {
    const pid = nextPid++;
    const { name } = procInfo;

    logger.info(`Kernel: Launching main-thread process '${name}' (PID ${pid})`);

    const historyEntry = {
      pid,
      name,
      status: 'RUNNING',
      startTime: new Date(),
      endTime: null,
      exitCode: null
    };
    processHistory.push(historyEntry);

    const process = {
      pid,
      name,
      worker: null,
      status: 'RUNNING',
      onExit: onExit || (() => {}),
      historyEntry
      // Notă: Procesele main-thread nu au nevoie de context `user` deocamdată,
      // deoarece singurul proces de acest tip (`terminal-process`) nu face syscalls VFS.
    };
    processList.set(pid, process);

    try {
      const module = await import(`/js/system/${name}.js`);
      if (!module?.process?.start || typeof module.process.start !== 'function') {
        throw new Error(`Main-thread process '${name}' is invalid or missing entry point.`);
      }

      await module.process.start({ pid, args: procInfo.args, cwd });
    } catch (error) {
      logger.error(`Kernel: Failed to start main-thread process '${name}': ${error.message}`);
      historyEntry.status = 'CRASHED';
      historyEntry.exitCode = 1;
      processList.delete(pid);
      onOutput?.({ message: error.message, isError: true });
      onExit?.(1);
    }
  },

  // --------------------------------------------------------
  // ⚙️ Run a Worker-Based Process (Pipeline Stage)
  // --------------------------------------------------------
  // MODIFICARE: Adăugăm `user` ca parametru
  _runPipelineStage(pipeline, finalOnOutput, finalOnExit, cwd, user, stdin) {
    if (!pipeline.length) {
      finalOnExit?.(0);
      return;
    }

    const procInfo = pipeline[0];
    const remainingPipeline = pipeline.slice(1);
    const pid = nextPid++;

    const worker = new Worker('/js/kernel/worker-process.js', { type: 'module' });
    const historyEntry = {
      pid,
      name: procInfo.name,
      status: 'RUNNING',
      startTime: new Date(),
      endTime: null,
      exitCode: null
    };
    processHistory.push(historyEntry);

    const process = {
      pid,
      name: procInfo.name,
      worker,
      status: 'RUNNING',
      onExit: finalOnExit,
      historyEntry,
      user: user || 'guest' // MODIFICARE: Stocăm utilizatorul pe obiectul procesului
    };
    processList.set(pid, process);

    let outputBuffer = '';

    worker.onmessage = async (e) => {
      const { type, payload } = e.data;
      switch (type) {
        case 'syscall':
          try {
            // ==========================================================
            // AICI ESTE LOGICA CHEIE PENTRU PERMISIUNI
            // ==========================================================
            // 1. Găsim procesul care a făcut cererea, folosind PID-ul trimis de worker
            const callingProcess = processList.get(payload.pid);
            // 2. Extragem utilizatorul din obiectul procesului (cu fallback la 'guest')
            const userForSyscall = callingProcess ? callingProcess.user : 'guest';
            // 3. Creăm noii parametri pentru syscall, adăugând `user`
            const syscallParams = { ...payload.params, user: userForSyscall };
            
            // 4. Executăm syscall-ul cu parametrii corecți
            const result = await _handleSyscallRequest(payload.name, syscallParams);
            // ==========================================================

            worker.postMessage({ type: 'syscall_result', payload: { result, callId: payload.callId } });
          } catch (error) {
            worker.postMessage({
              type: 'syscall_error',
              payload: { error: error.message || 'Syscall failed', callId: payload.callId }
            });
          }
          break;

        case 'stdout': {
          const message = payload.data.message ?? '';
          if (procInfo.stdout === 'pipe' || procInfo.stdout === 'file') {
            outputBuffer += message + (message.endsWith('\n') ? '' : '\n');
          } else {
            finalOnOutput?.(payload.data);
          }
          break;
        }

        case 'exit':
          processList.delete(pid);
          historyEntry.status = 'TERMINATED';
          historyEntry.endTime = new Date();
          historyEntry.exitCode = payload.exitCode;

          if (procInfo.stdout === 'pipe') {
            this._runPipelineStage(
              remainingPipeline,
              finalOnOutput,
              finalOnExit,
              cwd,
              user, // MODIFICARE: Pasăm `user` la următorul stagiu din pipeline
              outputBuffer.trimEnd()
            );
          } else if (procInfo.stdout === 'file') {
            // MODIFICARE: Pasăm și `user` la redirectarea către fișier
            await this._handleFileRedirect(procInfo, cwd, user, outputBuffer, finalOnOutput, finalOnExit);
          } else {
            finalOnExit?.(payload.exitCode);
          }
          break;

        case 'error':
          finalOnOutput?.({ type: 'error', message: payload.message });
          break;
      }
    };

    worker.onerror = (e) => {
      finalOnOutput?.({ type: 'error', message: `Process ${pid} error: ${e.message}` });
      _terminateWorkerProcess(process);
      processList.delete(pid);
      historyEntry.status = 'CRASHED';
      historyEntry.endTime = new Date();
      historyEntry.exitCode = 1;
      finalOnExit?.(1);
    };

    worker.postMessage({ type: 'init', payload: { procInfo, cwd, pid, stdin } });
  },

  // --------------------------------------------------------
  // 📄 Handle Output Redirection to File
  // --------------------------------------------------------
  // MODIFICARE: Adăugăm `user` ca parametru
  async _handleFileRedirect(procInfo, cwd, user, buffer, onOutput, onExit) {
    try {
      let content = buffer.trimEnd();
      if (procInfo.append) content = '\n' + content;

      // syscalls['vfs.writeFile'] este un wrapper care va ajunge tot la _handleSyscallRequest,
      // dar pentru a fi expliciți, adăugăm `user` și aici.
      await syscalls['vfs.writeFile']({
        path: resolvePath(cwd, procInfo.outputFile),
        content,
        append: procInfo.append,
        user: user // Asigurăm pasarea utilizatorului
      });

      onExit?.(0);
    } catch (e) {
      logger.error(`Kernel: Failed to write redirected output file: ${e.message}`);
      onOutput?.({ message: e.message, isError: true });
      onExit?.(1);
    }
  }
};