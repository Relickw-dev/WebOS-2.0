// File: js/kernel/syscalls.js
import { eventBus } from '../eventBus.js';

/**
 * Acest obiect rulează în thread-ul principal.
 * Kernel-ul primește cereri de syscall de la workeri (procese)
 * și apelează funcția corespunzătoare din acest obiect.
 */
export const syscalls = {
    // --- Terminal Syscalls ---
    'terminal.write': async (params) => {
        eventBus.emit('terminal.write', params);
    },
    'terminal.clear': async () => {
        eventBus.emit('terminal.clear');
    },
    'terminal.set_theme': async (params) => {
        eventBus.emit('terminal.set_theme', params);
    },

    // --- VFS Syscalls ---
    // Toate funcțiile VFS de mai jos sunt deja adaptate corect.
    // Ele preiau obiectul 'params' (care conține path, cwd, etc.)
    // și îl transmit mai departe prin eventBus folosind {...params}.
    'vfs.readDir': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.readDir', { ...params, resolve, reject });
        });
    },
    'vfs.stat': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.stat', { ...params, resolve, reject });
        });
    },
    'vfs.mkdir': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.mkdir', { ...params, resolve, reject });
        });
    },
    'vfs.writeFile': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.writeFile', { ...params, resolve, reject });
        });
    },
    'vfs.readFile': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.readFile', { ...params, resolve, reject });
        });
    },
    'vfs.rm': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.rm', { ...params, resolve, reject });
        });
    },
    'vfs.copyFile': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.copyFile', { ...params, resolve, reject });
        });
    },
    'vfs.move': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.move', { ...params, resolve, reject });
        });
    },
    'vfs.grep': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.grep', { ...params, resolve, reject });
        });
    },

    // --- Process Syscalls ---
    'proc.sleep': async ({ ms }) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    'proc.kill': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('proc.kill', { ...params, resolve, reject });
        });
    },
};

/**
 * Funcție Syscall pentru modulele care rulează în thread-ul principal (ex: shell.js).
 * @param {string} name - Numele syscall-ului.
 * @param {object} params - Parametrii pentru syscall.
 * @returns {Promise<any>}
 */
export async function syscall(name, params) {
    if (syscalls[name]) {
        return syscalls[name](params);
    }
    throw new Error(`Syscall '${name}' not found on main thread.`);
}