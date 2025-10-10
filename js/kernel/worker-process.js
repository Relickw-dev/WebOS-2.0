// File: js/kernel/worker-process.js
import { logger } from '../utils/logger.js';

/**
 * Worker-ul execută procese într-un sandbox și comunică bidirecțional cu kernel-ul
 * folosind postMessage(). Kernel-ul gestionează syscalls, IO și proces lifecycle.
 */

let callIdCounter = 0;
const syscallPromises = new Map();

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

  const callId = callIdCounter++;
  return new Promise((resolve, reject) => {
    syscallPromises.set(callId, { resolve, reject });

    postMessage({
      type: 'syscall',
      payload: { name, params, callId },
    });

    logger.debug(`Worker sent syscall '${name}' (callId=${callId})`);
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
  postMessage({ type: 'exit', payload: { exitCode: code } });
  logger.info(`Worker exited with code ${code}`);
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
        }
        break;
      }

      /** 🚀 Inițializare proces nou */
      case 'init': {
        const { procInfo, cwd, stdin } = payload || {};
        if (!procInfo || !procInfo.name) {
          throw new Error('Invalid process initialization payload.');
        }

        logger.info(`Worker initializing process '${procInfo.name}' (cwd: ${cwd || '/'})`);
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

    // Executăm generatorul și redirecționăm rezultatele către stdout
    for await (const result of module.logic(logicParams)) {
      if (result && result.type === 'stdout') {
        sendStdout(result.data);
      }
    }

    exitProcess(0);
  } catch (error) {
    sendError(error.message);
    exitProcess(1);
    logger.error(`Process '${procInfo.name}' crashed:`, error);
  }
}
