// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
// MODIFICARE: Importăm funcția syscall specifică pentru main-thread
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';
const commandHistory = [];
let historyIndex = 0;

function displayWelcomeMessage() {
    // MODIFICARE: Am adăugat un welcome art simplu
    const welcomeArt = ``;
    const welcomeMessage = `Welcome to WebOS 2.0. Type 'help' for a list of available commands.`;
    
    syscall('terminal.write', { message: welcomeArt });
    syscall('terminal.write', { message: welcomeMessage });
}

function resolvePath(basePath, newPath) {
    if (!newPath) return basePath;
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
            // Logica ta originală pentru focus și prompt
        });
        
        // Listener-ele de evenimente definite de tine
        eventBus.on('shell.input', handleInput);
        eventBus.on('shell.history.prev', handlePrevHistory);
        eventBus.on('shell.history.next', handleNextHistory);
        eventBus.on('shell.autocomplete', handleAutocomplete);

        // Listener-ul pentru noul syscall 'shell.get_history'
        eventBus.on('syscall.shell.get_history', ({ resolve }) => {
            resolve(commandHistory);
        });

        logger.info('Shell: Initialized.');
        displayWelcomeMessage(); 
        updatePrompt();
    }
};

function updatePrompt() {
    // În noua arhitectură, terminalul gestionează prompt-ul direct prin event
    eventBus.emit('terminal.prompt', { cwd: currentDirectory });
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
    
    if (commandString) {
        commandHistory.push(commandString);
        historyIndex = commandHistory.length;

        const [commandName] = commandString.split(' ');
        
        if (commandName === 'cd') {
            const [, ...args] = parseCommand(commandString);
            const targetPath = args[0] || '/';
            const resolvedPath = resolvePath(currentDirectory, targetPath);
            
            try {
                const stat = await syscall('vfs.stat', { path: resolvedPath, cwd: currentDirectory });
                if (stat.type !== 'dir') {
                    syscall('terminal.write', { message: `cd: not a directory: ${targetPath}`, isError: true });
                } else {
                    currentDirectory = resolvedPath;
                }
            } catch (e) {
                syscall('terminal.write', { message: `cd: no such file or directory: ${targetPath}`, isError: true });
            }
            updatePrompt();
            return;
        }

        if (commandName === 'clear') {
            syscall('terminal.clear');
            updatePrompt();
            return;
        }

        const pipeline = parsePipeline(commandString);
        
        eventBus.emit('proc.exec', {
            pipeline,
            onOutput: (data) => syscall('terminal.write', data),
            onExit: () => updatePrompt(),
            cwd: currentDirectory
        });
    } else {
        updatePrompt();
    }
}

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
            const names = matches.map(m => m.name).join('   ');
            syscall('terminal.write', { message: `\n${names}` });
            updatePrompt();
        }
    } catch (e) {
        logger.error(`Autocomplete failed: ${e.message}`);
    }
}