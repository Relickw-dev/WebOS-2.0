// File: js/kernel/syscalls.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

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

export const syscalls = {
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

  // VFS
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

  // Process
  'proc.sleep': async ({ ms }) => {
    logger.debug(`Syscall -> proc.sleep (${ms}ms)`);
    return new Promise((resolve) => setTimeout(resolve, ms));
  },
  'proc.kill': (params) => makeAsyncSyscall('proc.kill', params),

  // Auth (main-thread callers like shell will emit these events; kernel listens)
  'auth.listUsers': (params) => makeAsyncSyscall('auth.listUsers', params),
  'auth.getUser': (params) => makeAsyncSyscall('auth.getUser', params),
  'auth.switchUser': (params) => makeAsyncSyscall('auth.switchUser', params),
};

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
