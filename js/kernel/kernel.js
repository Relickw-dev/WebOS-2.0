// File: js/kernel/kernel.js
import { eventBus } from '../eventBus.js';
import { syscalls } from './syscalls.js';
import { logger } from '../utils/logger.js';
import { resolvePath } from '../utils/path.js';

// Kernel state
const processList = new Map();
const processHistory = [];
let nextPid = 1;

// User database (kernel-owned)
const validUsers = ['guest', 'user', 'root'];

// Internal syscall handler
async function _handleSyscallRequest(name, params) {
  try {
    // --- Auth/syscall handling for workers (direct calls) ---
    if (name === 'auth.listUsers') {
      return [...validUsers];
    }

    if (name === 'auth.getUser') {
      const pid = params?.pid;
      const proc = processList.get(Number(pid));
      return proc ? proc.user : 'guest';
    }

    if (name === 'auth.switchUser') {
      const pid = Number(params?.pid);
      const target = params?.target;
      if (!target || !validUsers.includes(target)) {
        throw new Error(`auth.switchUser: user '${target}' not found`);
      }
      const proc = processList.get(pid);
      if (!proc) throw new Error(`auth.switchUser: process PID ${pid} not found`);
      proc.user = target;
      logger.info(`Kernel: PID ${pid} switched to user '${target}'`);
      eventBus.emit('auth.user_changed', { pid, user: target });
      return { pid, user: target };
    }

    // Existing proc.* handling
    switch (name) {
      case 'proc.list':
        return Array.from(processList.values()).map(p => ({
          pid: p.pid,
          name: p.name,
          status: p.status,
          user: p.user
        }));

      case 'proc.history':
        return processHistory;

      default:
        // Delegate to device/event handlers (vfs, terminal, etc.)
        return await new Promise((resolve, reject) => {
          eventBus.emit(name, { ...params, resolve, reject });
        });
    }
  } catch (err) {
    logger.error(`Syscall ${name} failed: ${err?.message || err}`);
    throw err;
  }
}

function _terminateWorkerProcess(proc) {
  if (proc?.worker) {
    try {
      proc.worker.terminate();
    } catch (e) {
      logger.warn(`Failed to terminate worker PID ${proc.pid}: ${e.message}`);
    }
  }
}

export const kernel = {
  async init() {
    logger.info('Kernel: Initializing (Preemptive Mode)...');

    // Listen for proc events already used
    eventBus.on('proc.exec', (params) => this.handleProcessExecution(params));
    eventBus.on('proc.kill', (data) => this._handleKillRequest(data));

    // Listen for main-thread emitted auth/syscall requests
    eventBus.on('auth.listUsers', (params) => {
      const { resolve, reject } = params || {};
      _handleSyscallRequest('auth.listUsers', params).then(resolve).catch(reject);
    });
    eventBus.on('auth.getUser', (params) => {
      const { resolve, reject } = params || {};
      _handleSyscallRequest('auth.getUser', params).then(resolve).catch(reject);
    });
    eventBus.on('auth.switchUser', (params) => {
      const { resolve, reject } = params || {};
      _handleSyscallRequest('auth.switchUser', params).then(resolve).catch(reject);
    });

    logger.info('Kernel: Initialization complete.');
    eventBus.emit('kernel.boot_complete');
  },

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

  // entry
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
      this._runPipelineStage(pipeline, onOutput, onExit, cwd, user, null);
    }
  },

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
      historyEntry,
      user: 'guest'
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
      user: user || 'guest'
    };
    processList.set(pid, process);

    let outputBuffer = '';

    worker.onmessage = async (e) => {
      const { type, payload } = e.data;
      switch (type) {
        case 'syscall':
          try {
            const callingProcess = processList.get(payload.pid);
            const userForSyscall = callingProcess ? callingProcess.user : 'guest';
            const syscallParams = { ...payload.params, user: userForSyscall };
            const result = await _handleSyscallRequest(payload.name, syscallParams);
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
              user,
              outputBuffer.trimEnd()
            );
          } else if (procInfo.stdout === 'file') {
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

  async _handleFileRedirect(procInfo, cwd, user, buffer, onOutput, onExit) {
    try {
      let content = buffer.trimEnd();
      if (procInfo.append) content = '\n' + content;

      await syscalls['vfs.writeFile']({
        path: resolvePath(cwd, procInfo.outputFile),
        content,
        append: procInfo.append,
        user: user
      });

      onExit?.(0);
    } catch (e) {
      logger.error(`Kernel: Failed to write redirected output file: ${e.message}`);
      onOutput?.({ message: e.message, isError: true });
      onExit?.(1);
    }
  }
};
