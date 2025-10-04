// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';
const commandHistory = []; // Această variabilă rămâne aici
let historyIndex = 0;

// ... (funcțiile displayWelcomeMessage și resolvePath rămân neschimbate) ...
function displayWelcomeMessage() {
    const welcomeArt = ``;
    const welcomeMessage = `Welcome to WebOS 2.0. Type 'help' for a list of available commands.`;
    
    syscall('terminal.write', { message: welcomeArt });
    syscall('terminal.write', { message: welcomeMessage });
}
function resolvePath(basePath, newPath) {
    if (newPath.startsWith('/')) {
        return newPath;
    }

    const baseParts = basePath.split('/').filter(p => p.length > 0);
    const newParts = newPath.split('/');
    
    for (const part of newParts) {
        if (part === '..') {
            baseParts.pop();
        } else if (part !== '.' && part !== '') {
            baseParts.push(part);
        }
    }

    return '/' + baseParts.join('/');
}


export const shell = {
    init: () => {
        eventBus.on('kernel.boot_complete', () => {
            document.getElementById('terminal-input').focus();
            updatePrompt();
        });
        eventBus.on('shell.input', handleInput);
        
        eventBus.on('shell.history.prev', handlePrevHistory);
        eventBus.on('shell.history.next', handleNextHistory);
        eventBus.on('shell.autocomplete', handleAutocomplete);

        // --- MODIFICARE CHEIE 1: Adăugăm un listener pentru noul syscall ---
        // Acum, shell-ul acționează ca un serviciu care oferă istoricul la cerere.
        eventBus.on('syscall.shell.get_history', ({ resolve }) => {
            resolve(commandHistory);
        });

        logger.info('Shell: Initialized.');
        updatePrompt();
        displayWelcomeMessage(); 
    }
};

// ... (funcția updatePrompt și logica de parsare rămân neschimbate) ...
function updatePrompt() {
    document.getElementById('prompt').textContent = `user@webos:${currentDirectory}$`;
}
function parseCommand(commandString) {
    const parts = commandString.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    return parts.map(part => {
        if ((part.startsWith('"') && part.endsWith('"')) || (part.startsWith("'") && part.endsWith("'"))) {
            return part.slice(1, -1);
        }
        return part;
    });
}
function parsePipeline(fullCommand) {
    const pipeline = [];
    const commands = fullCommand.split('|').map(c => c.trim());

    for (let i = 0; i < commands.length; i++) {
        let commandStr = commands[i];
        let outputFile = null;
        let append = false;
        let stdout = 'terminal';

        if (commandStr.includes('>>')) {
            const parts = commandStr.split('>>').map(p => p.trim());
            commandStr = parts[0];
            outputFile = parts[1].split(' ')[0];
            stdout = 'file';
            append = true;
        } else if (commandStr.includes('>')) {
            const parts = commandStr.split('>').map(p => p.trim());
            commandStr = parts[0];
            outputFile = parts[1].split(' ')[0];
            stdout = 'file';
        }

        const [name, ...args] = parseCommand(commandStr);

        pipeline.push({
            name,
            args,
            stdout,
            outputFile,
            append
        });
    }

    for (let i = 0; i < pipeline.length - 1; i++) {
        pipeline[i].stdout = 'pipe';
    }

    return pipeline;
}


async function handleInput({ value }) {
    const commandString = value.trim();
    syscall('terminal.write', { message: commandString, isPrompt: true });
    
    if (commandString) {
        commandHistory.push(commandString);
        historyIndex = commandHistory.length;

        const [commandName] = commandString.split(' ');
        
        // --- MODIFICARE CHEIE 2: Eliminăm logica specială pentru 'history' ---
        // Comanda `history` va fi acum tratată ca orice altă comandă prin pipeline.
        if (commandName === 'cd') {
            const [, ...args] = commandString.split(' ');
            const targetPath = args.length > 0 ? args[0] : '/';

            // ... (restul logicii pentru 'cd' rămâne neschimbată)
            if (targetPath === '/' || targetPath === '~') {
                currentDirectory = '/';
                updatePrompt();
                return;
            }
            const resolvedTargetPath = resolvePath(currentDirectory, targetPath);
            if (targetPath.includes('..')) {
                 try {
                    const stat = await syscall('vfs.stat', { path: resolvedTargetPath });
                    if (stat && stat.type === 'dir') {
                        currentDirectory = resolvedTargetPath;
                        updatePrompt();
                        return;
                    }
                 } catch(e) { /* Ignorăm */ }
            }
            const pathParts = resolvedTargetPath.split('/').filter(p => p);
            const targetName = pathParts.pop() || '';
            const parentPath = '/' + pathParts.join('/');
            try {
                const parentEntries = await syscall('vfs.readDir', { path: parentPath });
                const match = parentEntries.find(entry => entry.name.toLowerCase() === targetName.toLowerCase());

                if (match && match.type === 'dir') {
                    const finalPath = [parentPath, match.name].join('/').replace(/\/+/g, '/');
                    currentDirectory = finalPath;
                } else if (match) {
                    syscall('terminal.write', { type: 'error', message: `cd: ${targetPath}: Not a directory` });
                } else {
                    syscall('terminal.write', { type: 'error', message: `cd: ${targetPath}: No such file or directory` });
                }
            } catch (e) {
                syscall('terminal.write', { type: 'error', message: `cd: ${targetPath}: No such file or directory` });
            }
            updatePrompt();
            return;
        }

        if (commandName === 'clear') {
            syscall('terminal.clear');
            updatePrompt();
            return;
        }

        // --- Blocul "if (commandName === 'history')" a fost ȘTERS de aici ---

        const pipeline = parsePipeline(commandString);
        
        eventBus.emit('proc.exec', {
            pipeline,
            onOutput: (data) => syscall('terminal.write', { message: data.message, type: data.type, isHtml: data.isHtml }),
            onExit: () => updatePrompt(),
            cwd: currentDirectory
        });
    } else {
        updatePrompt();
    }
}

// ... (restul fișierului: handlePrevHistory, handleNextHistory, handleAutocomplete rămân neschimbate) ...
function handlePrevHistory() {
    if (historyIndex > 0) {
        historyIndex--;
        eventBus.emit('terminal.set_input', { value: commandHistory[historyIndex] });
    }
}
function handleNextHistory() {
    if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        eventBus.emit('terminal.set_input', { value: commandHistory[historyIndex] });
    } else {
        historyIndex = commandHistory.length;
        eventBus.emit('terminal.set_input', { value: '' });
    }
}
async function handleAutocomplete({ value }) {
    const parts = value.split(' ');
    const toComplete = parts[parts.length - 1];

    if (!toComplete) return;

    try {
        const entries = await syscall('vfs.readDir', { path: currentDirectory });
        const matches = entries.filter(entry => entry.name.toLowerCase().startsWith(toComplete.toLowerCase()));

        if (matches.length === 1) {
            let completedName = matches[0].name;
            if (matches[0].type === 'dir') {
                completedName += '/';
            }
            parts[parts.length - 1] = completedName;
            const newValue = parts.join(' ');
            eventBus.emit('terminal.set_input', { value: newValue });
        } else if (matches.length > 1) {
            const names = matches.map(m => m.name).join('\n');
            syscall('terminal.write', { message: names });
        }
    } catch (e) {
        logger.error(`Autocomplete failed: ${e.message}`);
    }
}