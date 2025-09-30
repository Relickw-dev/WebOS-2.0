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
    'vfs.writeFile': async ({ path }) => {
        return new Promise((resolve, reject) => {
            eventBus.emit('vfs.writeFile', { path, resolve, reject });
        });
    },
    // Adaugă aici alte apeluri de sistem
};

export function syscall(name, params) {
    return new Promise((resolve, reject) => {
        eventBus.emit(`syscall.${name}`, { ...params, resolve, reject });
    });
}