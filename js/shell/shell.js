// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';

// Funcție ajutătoare pentru a rezolva căile relative
function resolvePath(basePath, newPath) {
    if (newPath.startsWith('/')) {
        return newPath;
    }

    const baseParts = basePath.split('/').filter(p => p.length > 0);
    const newParts = newPath.split('/');
    
    for (const part of newParts) {
        if (part === '..') {
            baseParts.pop();
        } else if (part !== '.') {
            baseParts.push(part);
        }
    }

    let resolvedPath = '/' + baseParts.join('/');
    if (resolvedPath === '') {
        resolvedPath = '/';
    }
    return resolvedPath;
}

export const shell = {
    init: () => {
        eventBus.on('kernel.boot_complete', () => {
            document.getElementById('terminal-input').focus();
            updatePrompt();
        });
        eventBus.on('shell.input', handleInput);
        logger.info('Shell: Initialized.');
        updatePrompt();
    }
};

function updatePrompt() {
    document.getElementById('prompt').textContent = `user@webos:${currentDirectory}$`;
}

async function handleInput({ value }) {
    const commandString = value.trim();
    syscall('terminal.write', { message: commandString, isPrompt: true });
    
    if (commandString) {
        const [commandName, ...args] = commandString.split(' ');
        
        // Comenzi interne
        if (commandName === 'cd') {
            const targetPath = args.length > 0 ? args[0] : '/';
            const newPath = resolvePath(currentDirectory, targetPath);

            try {
                const stat = await syscall('vfs.stat', { path: newPath });
                if (stat.type === 'directory') {
                    currentDirectory = newPath;
                } else {
                    syscall('terminal.write', { type: 'error', message: `cd: ${targetPath}: Not a directory` });
                }
            } catch (e) {
                syscall('terminal.write', { type: 'error', message: `cd: ${targetPath}: No such file or directory` });
            }

            updatePrompt();
            return;
        }

        // Comenzi externe (trimise către kernel)
        const pipeline = [{ name: commandName, args }];
        eventBus.emit('proc.exec', {
            pipeline,
            onOutput: (data) => syscall('terminal.write', { message: data.message, type: data.type }),
            onExit: () => updatePrompt(),
            cwd: currentDirectory
        });
    } else {
        updatePrompt();
    }
}