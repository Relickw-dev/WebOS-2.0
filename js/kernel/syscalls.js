// File: js/kernel/syscalls.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

/**
 * ============================================================
 * Syscalls Registry
 * ------------------------------------------------------------
 * Acest modul rulează în thread-ul principal și acționează ca
 * intermediar între kernel și driverele (Terminal, VFS, Proc).
 * Workeri trimit cereri syscall, kernelul le redirecționează aici.
 * ============================================================
 */

/**
 * Helper pentru a crea un syscall bazat pe eveniment.
 * Returnează un Promise care este rezolvat/rejectat de driver.
 * 
 * @param {string} eventName - Numele evenimentului din eventBus.
 * @param {object} params - Parametrii syscall-ului.
 * @returns {Promise<any>}
 */
function makeAsyncSyscall(eventName, params = {}) {
  return new Promise((resolve, reject) => {
    try {
      eventBus.emit(eventName, { ...params, resolve, reject });
      logger.debug(`Syscall emitted: '${eventName}'`, params);
    } catch (error) {
      logger.error(`Syscall emit failed for '${eventName}':`, error);
      reject(error);
    }
  });
}

/**
 * Syscalls map — definim funcțiile disponibile în kernel.
 */
export const syscalls = {
  // --- Terminal Syscalls ---
  'terminal.write': async (params) => {
    logger.debug('Syscall -> terminal.write', params);
    eventBus.emit('terminal.write', params);
  },
  'terminal.clear': async () => {
    logger.debug('Syscall -> terminal.clear');
    eventBus.emit('terminal.clear');
  },
  'terminal.set_theme': async (params) => {
    logger.debug('Syscall -> terminal.set_theme', params);
    eventBus.emit('terminal.set_theme', params);
  },

  // --- VFS Syscalls ---
  'vfs.readDir': (params) => makeAsyncSyscall('vfs.readDir', params),
  'vfs.stat': (params) => makeAsyncSyscall('vfs.stat', params),
  'vfs.mkdir': (params) => makeAsyncSyscall('vfs.mkdir', params),
  'vfs.writeFile': (params) => makeAsyncSyscall('vfs.writeFile', params),
  'vfs.readFile': (params) => makeAsyncSyscall('vfs.readFile', params),
  'vfs.rm': (params) => makeAsyncSyscall('vfs.rm', params),
  'vfs.copyFile': (params) => makeAsyncSyscall('vfs.copyFile', params),
  'vfs.move': (params) => makeAsyncSyscall('vfs.move', params),
  'vfs.grep': (params) => makeAsyncSyscall('vfs.grep', params),
  'vfs.chmod': (params) => makeAsyncSyscall('vfs.chmod', params),

  // --- Process Syscalls ---
  'proc.sleep': async ({ ms }) => {
    logger.debug(`Syscall -> proc.sleep (${ms}ms)`);
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  'proc.kill': (params) => makeAsyncSyscall('proc.kill', params),
};

/**
 * ============================================================
 * syscall(name, params)
 * ------------------------------------------------------------
 * Funcție folosită de modulele care rulează în thread-ul principal
 * (ex: shell.js). Verifică existența syscall-ului și îl execută.
 * ============================================================
 * 
 * @param {string} name - Numele syscall-ului.
 * @param {object} [params={}] - Parametrii pentru syscall.
 * @returns {Promise<any>}
 */
export async function syscall(name, params = {}) {
  if (!name || typeof name !== 'string') {
    const err = new Error('Invalid syscall name');
    logger.error(err.message);
    throw err;
  }

  const fn = syscalls[name];
  if (typeof fn !== 'function') {
    const err = new Error(`Syscall '${name}' not found on main thread.`);
    logger.error(err.message);
    throw err;
  }

  try {
    logger.debug(`Executing syscall '${name}' with params:`, params);
    const result = await fn(params);
    logger.debug(`Syscall '${name}' completed successfully.`);
    return result;
  } catch (error) {
    logger.error(`Syscall '${name}' failed:`, error);
    throw error;
  }
}
