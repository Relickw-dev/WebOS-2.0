// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';
const commandHistory = [];
let historyIndex = 0;

function displayWelcomeMessage() {
    const welcomeArt = ``;
    const welcomeMessage = `Welcome to WebOS 2.0. Type 'help' for a list of available commands.`;
    syscall('terminal.write', { message: welcomeArt });
    syscall('terminal.write', { message: welcomeMessage });
}

function resolvePath(basePath, newPath) {
    if (!newPath) return basePath;
    if (newPath.startsWith('/')) return newPath;
    const baseParts = basePath.split('/').filter(p => p.length > 0);
    const newParts = newPath.split('/');
    for (const part of newParts) {
        if (part === '..') baseParts.pop();
        else if (part !== '.' && part !== '') baseParts.push(part);
    }
    return '/' + baseParts.join('/');
}

export const shell = {
    init: () => {
        eventBus.on('shell.input', handleInput);
        eventBus.on('shell.history.prev', handlePrevHistory);
        eventBus.on('shell.history.next', handleNextHistory);
        eventBus.on('shell.autocomplete', handleAutocomplete);
        eventBus.on('syscall.shell.get_history', ({ resolve }) => {
            resolve(commandHistory);
        });
        logger.info('Shell: Initialized.');
        displayWelcomeMessage(); 
        updatePrompt();
    }
};

function updatePrompt() {
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

        if (!name) continue; // Ignoră comenzile goale (ex: `cat file | | grep a`)

        pipeline.push({
            name,
            args,
            stdout,
            outputFile,
            append
        });
    }

    // Setează stdout-ul la 'pipe' pentru toate comenzile, cu excepția ultimei
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

        const [commandName] = parseCommand(commandString);
        
        if (commandName === 'cd') {
            const [, targetPath = '/'] = parseCommand(commandString);
            const resolvedPath = resolvePath(currentDirectory, targetPath);
            try {
                const stat = await syscall('vfs.stat', { path: resolvedPath });
                if (stat.type !== 'directory') {
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
            // Asigurăm că `data` este un obiect, așa cum se așteaptă terminalul.
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
    if (historyIndex < commandHistory.length) {
        const value = commandHistory[historyIndex] || '';
        eventBus.emit('terminal.set_input', { value });
        historyIndex++;
    } else {
        historyIndex = commandHistory.length;
        eventBus.emit('terminal.set_input', { value: '' });
    }
}


async function handleAutocomplete({ value }) {
    const parts = value.split(' ');
    // 'toComplete' este ultimul cuvânt de pe linie, cel pe care încercăm să-l completăm.
    const toComplete = parts[parts.length - 1];
    if (!toComplete) return;

    try {
        // 1. Apelăm syscall-ul pentru a citi conținutul directorului curent.
        //    'await' asigură că așteptăm răspunsul de la sistemul de fișiere.
        const entries = await syscall('vfs.readDir', { path: currentDirectory });

        // 2. Filtrăm intrările pentru a găsi cele care încep cu textul de completat.
        const matches = entries.filter(entry => entry.name.toLowerCase().startsWith(toComplete.toLowerCase()));

        // 3. Cazul 1: O singură potrivire. Completăm automat.
        if (matches.length === 1) {
            let completedName = matches[0].name;
            // Adăugăm '/' la final dacă este un director, pentru ușurință în navigare.
            if (matches[0].type === 'dir' || matches[0].type === 'directory') completedName += '/';
            
            parts[parts.length - 1] = completedName;
            
            // Emitem un eveniment pentru ca terminal.js să actualizeze input-ul.
            eventBus.emit('terminal.set_input', { value: parts.join(' ') });
        } 
        // 4. Cazul 2: Mai multe potriviri. Le afișăm pe toate.
        else if (matches.length > 1) {
            const names = matches.map(m => m.name).join('   ');
            
            // --- MODIFICARE AICI ---
            // Folosim 'await' pentru a ne asigura că numele sunt scrise înainte de a redesena prompt-ul.
            await syscall('terminal.write', { message: `\n${names}` });
            
            // Redesenăm prompt-ul pe linia următoare.
            updatePrompt();
        }
        // Dacă nu există potriviri (matches.length === 0), nu facem nimic.

    } catch (e) {
        logger.error(`Autocomplete failed: ${e.message}`);
    }
}