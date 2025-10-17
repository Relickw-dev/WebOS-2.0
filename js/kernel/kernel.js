// File: js/kernel/kernel.js (FIXED VERSION)
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

// FIX #1: Add user validation helper
function _validateUser(user) {
  if (!user || typeof user !== 'string') {
    throw new Error('User must be a non-empty string');
  }
  if (!validUsers.includes(user)) {
    throw new Error(`Invalid user: '${user}'. Valid users: ${validUsers.join(', ')}`);
  }
}

// Internal syscall handler
async function _handleSyscallRequest(name, params) {
  try {
    // --- Auth/syscall handling for workers (direct calls) ---
    if (name === 'auth.listUsers') {
      return [...validUsers];
    }

    if (name === 'auth.getUser') {
      const pid = params?.pid;
      if (typeof pid !== 'number') {
        throw new Error('auth.getUser: PID must be a number');
      }
      const proc = processList.get(Number(pid));
      if (!proc) {
        logger.warn(`auth.getUser: Process PID ${pid} not found, returning 'guest'`);
        return 'guest';
      }
      return proc.user || 'guest';
    }

    if (name === 'auth.switchUser') {
      const pid = Number(params?.pid);
      const target = params?.target;
      
      // FIX #2: Validate user before switching
      _validateUser(target);
      
      const proc = processList.get(pid);
      if (!proc) {
        throw new Error(`auth.switchUser: process PID ${pid} not found`);
      }
      
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
      logger.info(`Worker PID ${proc.pid} terminated successfully`);
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
    eventBus.on('proc.list', ({ resolve, reject }) => {
      try {
        const processArray = Array.from(processList.values());
        resolve(processArray);
      } catch (err) {
        reject(err);
      }
    });
    eventBus.on('proc.history', ({ resolve, reject }) => {
      try {
        resolve(processHistory);
      } catch (err) {
        reject(err);
      }
    });

    logger.info('Kernel: Initialization complete.');
    eventBus.emit('kernel.boot_complete');
  },

  async _handleKillRequest({ pid, resolve, reject }) {
    const pidToKill = parseInt(pid, 10);
    
    // FIX #3: Validate PID
    if (!Number.isFinite(pidToKill) || pidToKill < 1) {
      const msg = `kill: Invalid PID ${pid}`;
      logger.warn(msg);
      return reject(new Error(msg));
    }
    
    const process = processList.get(pidToKill);

    if (!process) {
      const msg = `kill: Process with PID ${pidToKill} not found.`;
      logger.warn(msg);
      return reject(new Error(msg));
    }

    logger.info(`Kernel: Received kill signal for PID ${pidToKill} (${process.name})`);

    const entry = process.historyEntry;
    if (entry) {
      entry.status = 'KILLED';
      entry.endTime = new Date();
      entry.exitCode = 143; // SIGTERM exit code
    }

    try {
      if (process.worker) {
        _terminateWorkerProcess(process);
        // FIX #4: Call onExit with proper signal code
        process.onExit?.(143);
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
    // FIX #5: Validate pipeline structure
    if (!Array.isArray(pipeline) || !pipeline.length) {
      logger.warn('Kernel: Received empty or invalid pipeline.');
      onExit?.(1);
      return;
    }

    // FIX #6: Validate each stage has required properties
    for (let i = 0; i < pipeline.length; i++) {
      const stage = pipeline[i];
      if (!stage || typeof stage !== 'object') {
        logger.error(`Kernel: Pipeline stage ${i} is invalid`);
        onOutput?.({ message: `Invalid pipeline stage ${i}`, isError: true });
        onExit?.(1);
        return;
      }
      if (!stage.name || typeof stage.name !== 'string') {
        logger.error(`Kernel: Pipeline stage ${i} missing valid 'name' property`);
        onOutput?.({ message: `Pipeline stage ${i} missing command name`, isError: true });
        onExit?.(1);
        return;
      }
    }

    const procInfo = pipeline[0];
    
    // FIX #7: Default user to 'guest' if not provided
    const effectiveUser = user || 'guest';
    
    // FIX #8: Validate user
    try {
      _validateUser(effectiveUser);
    } catch (err) {
      logger.error(`Kernel: Invalid user for process execution: ${err.message}`);
      onOutput?.({ message: err.message, isError: true });
      onExit?.(1);
      return;
    }

    if (procInfo.runOn === 'main') {
      await this._runMainThreadProcess(procInfo, onOutput, onExit, cwd, effectiveUser);
    } else {
      this._runPipelineStage(pipeline, onOutput, onExit, cwd, effectiveUser, null);
    }
  },

  async _runMainThreadProcess(procInfo, onOutput, onExit, cwd, user) {
    const pid = nextPid++;
    const { name } = procInfo;

    logger.info(`Kernel: Launching main-thread process '${name}' (PID ${pid}) as user '${user}'`);

    const historyEntry = {
      pid,
      name,
      status: 'RUNNING',
      startTime: new Date(),
      endTime: null,
      exitCode: null,
      user // FIX #9: Track user in history
    };
    processHistory.push(historyEntry);

    const process = {
      pid,
      name,
      worker: null,
      status: 'RUNNING',
      onExit: onExit || (() => {}),
      historyEntry,
      user
    };
    processList.set(pid, process);

    try {
      // FIX #10: Validate process name before import
      const validNameRegex = /^[a-zA-Z0-9_-]+$/;
      if (!validNameRegex.test(name)) {
        throw new Error(`Invalid process name: '${name}'`);
      }

      const module = await import(`/js/system/${name}.js`);
      if (!module?.process?.start || typeof module.process.start !== 'function') {
        throw new Error(`Main-thread process '${name}' is invalid or missing entry point.`);
      }

      await module.process.start({ pid, args: procInfo.args, cwd, user });
    } catch (error) {
      logger.error(`Kernel: Failed to start main-thread process '${name}': ${error.message}`);
      historyEntry.status = 'CRASHED';
      historyEntry.endTime = new Date();
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

    // FIX #11: Ensure user is always passed through pipeline
    const effectiveUser = user || 'guest';

    const worker = new Worker('/js/kernel/worker-process.js', { type: 'module' });
    const historyEntry = {
      pid,
      name: procInfo.name,
      status: 'RUNNING',
      startTime: new Date(),
      endTime: null,
      exitCode: null,
      user: effectiveUser // FIX #12: Track user in history
    };
    processHistory.push(historyEntry);

    const process = {
      pid,
      name: procInfo.name,
      worker,
      status: 'RUNNING',
      onExit: finalOnExit,
      historyEntry,
      user: effectiveUser
    };
    processList.set(pid, process);

    let outputBuffer = '';

    // FIX #13: Add worker error timeout
    const workerTimeout = setTimeout(() => {
      logger.warn(`Worker PID ${pid} (${procInfo.name}) has been running for over 60s`);
    }, 60000);

    worker.onmessage = async (e) => {
      const { type, payload } = e.data;
      switch (type) {
        case 'syscall':
          try {
            const callingProcess = processList.get(payload.pid);
            const userForSyscall = callingProcess ? callingProcess.user : effectiveUser;
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
          clearTimeout(workerTimeout); // FIX #14: Clear timeout on exit
          processList.delete(pid);
          historyEntry.status = 'TERMINATED';
          historyEntry.endTime = new Date();
          historyEntry.exitCode = payload.exitCode;

          if (procInfo.stdout === 'pipe') {
            // FIX #15: Pass user to next pipeline stage
            this._runPipelineStage(
              remainingPipeline,
              finalOnOutput,
              finalOnExit,
              cwd,
              effectiveUser, // Explicitly pass user
              outputBuffer.trimEnd()
            );
          } else if (procInfo.stdout === 'file') {
            // FIX #16: Pass user to file redirect handler
            await this._handleFileRedirect(procInfo, cwd, effectiveUser, outputBuffer, finalOnOutput, finalOnExit);
          } else {
            finalOnExit?.(payload.exitCode);
          }
          break;

        case 'error':
          clearTimeout(workerTimeout); // FIX #17: Clear timeout on error
          finalOnOutput?.({ message: payload.message, isError: true });
          break;
      }
    };

    worker.onerror = (e) => {
      clearTimeout(workerTimeout);
      finalOnOutput?.({ message: `Process ${pid} error: ${e.message}`, isError: true });
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

      // FIX #18: Validate output file path
      const outputPath = resolvePath(cwd, procInfo.outputFile);
      if (!outputPath || outputPath === '/') {
        throw new Error('Invalid output file path');
      }

      await syscalls['vfs.writeFile']({
        path: outputPath,
        content,
        append: procInfo.append,
        user: user // Ensure user is passed
      });

      onExit?.(0);
    } catch (e) {
      logger.error(`Kernel: Failed to write redirected output file: ${e.message}`);
      onOutput?.({ message: e.message, isError: true });
      onExit?.(1);
    }
  }
};