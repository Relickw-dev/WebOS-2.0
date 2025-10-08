// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';
const commandHistory = [];
let historyIndex = 0;
let availableCommands = [];

let autocompleteSession = {
    lastCompletedValue: null, // Ultima valoare setată de autocompletare
    matches: [],
    currentIndex: 0,
    contextType: null,
    prefix: '', // Tot ce e înainte de segmentul curent (ex: 'cmd | ')
    baseSegment: '' // Segmentul original pe care se face completarea
};

async function fetchCommands() {
    try {
        const response = await fetch('http://localhost:3000/api/commands');
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        const commandsFromServer = await response.json();
        availableCommands = [...new Set([...commandsFromServer, 'cd', 'clear'])];
        logger.info(`Shell: Successfully loaded ${availableCommands.length} commands.`);
    } catch (error) {
        logger.error(`Failed to fetch commands: ${error.message}. Falling back to a predefined list.`);
        availableCommands = ['cat', 'cd', 'clear', 'cp', 'date', 'echo', 'grep', 'head', 'help', 'history', 'kill', 'ls', 'mkdir', 'mv', 'ps', 'pwd', 'rm', 'sleep', 'stat', 'theme', 'touch', 'wc'];
    }
}

function displayWelcomeMessage() {
    // Am eliminat complet ASCII art-ul pentru un aspect curat.
    const welcomeMessage = `Solus [Version 1.0]
An open-source project.

Type 'help' for a list of available commands.
`;

    // Se folosește un singur apel pentru a afișa tot mesajul.
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
    init: async () => {
        await fetchCommands();
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
    // O nouă căutare este necesară dacă utilizatorul a modificat manual textul.
    // Altfel, se continuă ciclul prin rezultatele deja găsite.
    const isNewSearch = value !== autocompleteSession.lastCompletedValue;

    if (isNewSearch) {
        autocompleteSession.currentIndex = 0;
        
        // --- 1. Izolarea segmentului curent (partea de după ultimul '|') ---
        const lastPipeIndex = value.lastIndexOf('|');
        const segment = (lastPipeIndex === -1) ? value : value.substring(lastPipeIndex + 1);

        // --- 2. Determinarea corectă și robustă a contextului (command vs. argument) ---
        const wordsInSegment = segment.trim().split(/\s+/).filter(p => p.length > 0);

        if (wordsInSegment.length === 0) {
            // Cazuri: "", "   ", "history | ", "history |   "
            // Urmează să scriem o comandă.
            autocompleteSession.contextType = 'command';
        } else if (wordsInSegment.length === 1 && !value.endsWith(' ')) {
            // Cazuri: "c", "ca", "history | gr"
            // Încă scriem la prima comandă din segment.
            autocompleteSession.contextType = 'command';
        } else {
            // Cazuri: "ls ", "ls u", "history | grep ", "history | grep u"
            // Am terminat comanda și acum completăm un argument.
            autocompleteSession.contextType = 'argument';
        }
        
        // --- 3. Pregătirea pentru căutare ---
        autocompleteSession.prefix = (lastPipeIndex === -1) ? '' : value.substring(0, lastPipeIndex + 1);
        autocompleteSession.baseSegment = segment;
        
        const wordToComplete = segment.trimStart().split(/\s+/).pop() || '';

        // --- 4. Căutarea potrivirilor în funcție de context ---
        if (autocompleteSession.contextType === 'command') {
            autocompleteSession.matches = availableCommands.filter(name =>
                name.toLowerCase().startsWith(wordToComplete.toLowerCase())
            );
        } else { // contextType === 'argument'
            let prefixPath = wordToComplete;
            let basePath = '';
            const lastSlashIndex = prefixPath.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                basePath = prefixPath.substring(0, lastSlashIndex + 1);
                prefixPath = prefixPath.substring(lastSlashIndex + 1);
            }
            const searchPath = resolvePath(currentDirectory, basePath);
            try {
                const entries = await syscall('vfs.readDir', { path: searchPath });
                autocompleteSession.matches = entries
                    .filter(entry => entry.name.toLowerCase().startsWith(prefixPath.toLowerCase()))
                    .map(entry => {
                        let name = basePath + entry.name;
                        if (entry.type === 'directory') name += '/';
                        return name;
                    });
            } catch (e) {
                autocompleteSession.matches = [];
            }
        }
    }

    if (autocompleteSession.matches.length === 0) {
        autocompleteSession.lastCompletedValue = null;
        return;
    }

    const currentMatch = autocompleteSession.matches[autocompleteSession.currentIndex];
    
    // --- 5. Reconstrucția corectă a valorii ---
    const base = autocompleteSession.baseSegment;
    let newValue;
    
    if (base.endsWith(' ')) {
        // Dacă segmentul de bază se termina cu spațiu, adăugăm potrivirea.
        newValue = autocompleteSession.prefix + base + currentMatch;
    } else {
        // Altfel, înlocuim ultimul cuvânt parțial.
        const parts = base.split(/\s+/);
        parts[parts.length - 1] = currentMatch;
        newValue = autocompleteSession.prefix + parts.join(' ');
    }
    
    eventBus.emit('terminal.set_input', { value: newValue });
    
    // Actualizăm starea pentru următorul ciclu
    autocompleteSession.lastCompletedValue = newValue;
    autocompleteSession.currentIndex = (autocompleteSession.currentIndex + 1) % autocompleteSession.matches.length;
}