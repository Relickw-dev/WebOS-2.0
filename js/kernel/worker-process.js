// File: js/kernel/worker-process.js (FIXED VERSION)
import { logger } from '../utils/logger.js';

/**
 * Worker-ul execută procese într-un sandbox și comunică bidirecțional cu kernel-ul
 * folosind postMessage(). Kernel-ul gestionează syscalls, IO și proces lifecycle.
 */

let callIdCounter = 0;
const syscallPromises = new Map();
let processPID = -1;
let isInitialized = false; // NEW: Track initialization state

/**
 * Trimite o cerere syscall către kernel și așteaptă răspunsul.
 * @param {string} name - Numele syscall-ului (ex: "vfs.readDir").
 * @param {object} params - Parametrii pentru syscall.
 * @returns {Promise<any>}
 */
function syscall(name, params = {}) {
  if (typeof name !== 'string' || !name.trim()) {
    const err = new Error('Invalid syscall name');
    logger.error('Worker syscall failed:', err.message);
    return Promise.reject(err);
  }

  // FIX #1: Prevent syscalls before initialization
  if (!isInitialized || processPID === -1) {
    const err = new Error(`Syscall '${name}' attempted before process initialization (PID: ${processPID})`);
    logger.error('Worker syscall failed:', err.message);
    return Promise.reject(err);
  }

  const callId = callIdCounter++;
  
  // FIX #2: Add timeout to prevent hanging syscalls
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (syscallPromises.has(callId)) {
        cleanupSyscall(callId);
        reject(new Error(`Syscall '${name}' timeout after 30s (callId=${callId})`));
      }
    }, 30000); // 30 second timeout

    syscallPromises.set(callId, { 
      resolve: (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      }, 
      reject: (error) => {
        clearTimeout(timeoutId);
        reject(error);
      }
    });

    postMessage({
      type: 'syscall',
      payload: { name, params, callId, pid: processPID },
    });

    logger.debug(`Worker (PID ${processPID}) sent syscall '${name}' (callId=${callId})`);
  });
}

/**
 * Curăță o promisiune syscall (evită scurgeri de memorie).
 */
function cleanupSyscall(callId) {
  if (syscallPromises.has(callId)) {
    syscallPromises.delete(callId);
    logger.debug(`Syscall ${callId} cleaned up.`);
  }
}

/**
 * Trimite date către stdout.
 */
function sendStdout(data) {
  if (data != null) {
    postMessage({ type: 'stdout', payload: { data } });
    logger.debug('Worker stdout ->', data);
  }
}

/**
 * Trimite o eroare către kernel.
 */
function sendError(message) {
  const msg = message || 'Unknown worker error';
  postMessage({ type: 'error', payload: { message: msg } });
  logger.error('Worker error ->', msg);
}

/**
 * Închide procesul curent.
 */
function exitProcess(code = 0) {
  // FIX #3: Cleanup all pending syscalls on exit
  if (syscallPromises.size > 0) {
    logger.warn(`Worker (PID ${processPID}) exiting with ${syscallPromises.size} pending syscalls`);
    syscallPromises.forEach((promise, callId) => {
      promise.reject(new Error('Process terminated while syscall was pending'));
      cleanupSyscall(callId);
    });
  }
  
  postMessage({ type: 'exit', payload: { exitCode: code } });
  logger.info(`Worker (PID ${processPID}) exited with code ${code}`);
  
  // Reset state
  isInitialized = false;
  processPID = -1;
}

/**
 * Procesează mesajele primite din partea kernel-ului.
 */
self.onmessage = async (e) => {
  const { type, payload } = e.data || {};
  logger.debug(`Worker received message: ${type}`);

  try {
    switch (type) {
      /** ✅ Rezultat syscall reușit */
      case 'syscall_result': {
        const { result, callId } = payload || {};
        const promise = syscallPromises.get(callId);
        if (promise) {
          promise.resolve(result);
          cleanupSyscall(callId);
          logger.debug(`Syscall ${callId} resolved successfully.`);
        } else {
          logger.warn(`Received result for unknown syscall ${callId}`);
        }
        break;
      }

      /** ❌ Eroare syscall */
      case 'syscall_error': {
        const { error, callId } = payload || {};
        const promise = syscallPromises.get(callId);
        if (promise) {
          promise.reject(new Error(error || 'Unknown syscall error'));
          cleanupSyscall(callId);
          logger.warn(`Syscall ${callId} failed: ${error}`);
        } else {
          logger.warn(`Received error for unknown syscall ${callId}`);
        }
        break;
      }

      /** 🚀 Inițializare proces nou */
      case 'init': {
        const { procInfo, cwd, pid, stdin } = payload || {};
        
        // FIX #4: Validate initialization payload
        if (!procInfo || !procInfo.name) {
          throw new Error('Invalid process initialization payload: missing procInfo or procInfo.name');
        }
        
        if (typeof pid !== 'number' || pid < 0) {
          throw new Error(`Invalid process initialization payload: invalid PID ${pid}`);
        }

        // FIX #5: Prevent re-initialization
        if (isInitialized) {
          logger.warn(`Worker (PID ${processPID}) received duplicate init message, ignoring`);
          break;
        }

        processPID = pid;
        isInitialized = true;

        logger.info(`Worker (PID ${processPID}) initializing process '${procInfo.name}' (cwd: ${cwd || '/'})`);
        await runProcess(procInfo, cwd, stdin);
        break;
      }

      /** ⚠️ Tip necunoscut */
      default:
        logger.warn('Worker received unknown message type:', type);
    }
  } catch (err) {
    sendError(err?.message || 'Worker internal error');
    exitProcess(1);
    logger.error('Worker crashed during message handling:', err);
  }
};

/**
 * Încarcă și execută logica unui proces.
 */
async function runProcess(procInfo, cwd, stdin) {
  try {
    // FIX #6: Validate process name to prevent code injection
    const validNameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!validNameRegex.test(procInfo.name)) {
      throw new Error(`Invalid process name: '${procInfo.name}'. Only alphanumeric, underscore, and hyphen allowed.`);
    }

    // Importăm modulul de execuție (dinamic, în funcție de numele comenzii)
    const module = await import(`/js/bin/${procInfo.name}.js`);
    logger.debug(`Loaded module for '${procInfo.name}'`);

    if (!module.logic || typeof module.logic !== 'function') {
      throw new Error(`Command '${procInfo.name}' is missing a valid 'logic' function.`);
    }

    // Parametrii transmiși funcției generator 'logic'
    const logicParams = {
      args: procInfo.args || [],
      cwd: cwd || '/',
      stdin,
      syscall,
    };

    // FIX #7: Add error handling for generator execution
    try {
      // Executăm generatorul și redirecționăm rezultatele către stdout
      for await (const result of module.logic(logicParams)) {
        if (result && result.type === 'stdout') {
          sendStdout(result.data);
        }
      }
      exitProcess(0);
    } catch (generatorError) {
      logger.error(`Process '${procInfo.name}' logic failed:`, generatorError);
      sendError(`Command execution failed: ${generatorError.message}`);
      exitProcess(1);
    }
  } catch (error) {
    sendError(error.message);
    exitProcess(1);
    logger.error(`Process '${procInfo.name}' crashed:`, error);
  }
}

// FIX #8: Handle worker termination gracefully
self.addEventListener('error', (event) => {
  logger.error('Worker unhandled error:', event.message);
  sendError(`Worker error: ${event.message}`);
  exitProcess(1);
});

self.addEventListener('unhandledrejection', (event) => {
  logger.error('Worker unhandled promise rejection:', event.reason);
  sendError(`Unhandled promise rejection: ${event.reason}`);
  exitProcess(1);
});