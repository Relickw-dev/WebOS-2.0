// File: js/kernel/syscalls.js
import { eventBus } from '../eventBus.js';

export const syscalls = {
    'terminal.write': async ({ message, isPrompt }) => {
        eventBus.emit('terminal.write', { message, isPrompt });
    },
    'terminal.clear': async () => {
        eventBus.emit('terminal.clear');
    },
    'vfs.readDir': async ({ path }) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.readDir', { path, resolve, reject });
        });
    },
    'vfs.stat': async ({ path }) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.stat', { path, resolve, reject });
        });
    },
    'vfs.mkdir': async ({ path }) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.mkdir', { path, resolve, reject });
        });
    },
    'vfs.writeFile': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.writeFile', { ...params, resolve, reject });
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
    'vfs.readFile': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.readFile', { ...params, resolve, reject });
        });
    },
    'vfs.grep': (params) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.grep', { ...params, resolve, reject });
        });
    }
    // Adaugă aici alte apeluri de sistem
};

export function syscall(name, params) {
    return new Promise((resolve, reject) => {
        eventBus.emit(`syscall.${name}`, { ...params, resolve, reject });
    });
}