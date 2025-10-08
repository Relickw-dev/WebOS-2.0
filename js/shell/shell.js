// File: js/shell/shell.js (Versiune refactorizată ca o Clasă)
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

// --- Funcții Helper și Stare Globală (partajată între toate instanțele de shell) ---

let availableCommands = [];
let commandsFetched = false; // Flag pentru a ne asigura că preluăm comenzile o singură dată

async function fetchCommands() {
    if (commandsFetched) return;
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
    commandsFetched = true;
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
        if (!name) continue;

        pipeline.push({ name, args, stdout, outputFile, append });
    }

    for (let i = 0; i < pipeline.length - 1; i++) {
        pipeline[i].stdout = 'pipe';
    }
    return pipeline;
}


// --- Clasa Shell ---

export class Shell {
    constructor(terminalInstance) {
        this.terminal = terminalInstance;
        this.pid = terminalInstance.pid;
        
        // Starea specifică acestei instanțe
        this.currentDirectory = '/';
        this.commandHistory = [];
        this.historyIndex = 0;
        this.autocompleteSession = {
            lastCompletedValue: null,
            matches: [],
            currentIndex: 0,
            contextType: null,
            prefix: '',
            baseSegment: ''
        };

        // Inițializarea asincronă se face separat
        this.init();
    }

    async init() {
        await fetchCommands();
        
        // În loc de listeneri globali, terminalul va apela direct aceste metode.
        // Păstrăm un listener global doar pentru syscalls care ar putea viza shell-ul.
        eventBus.on('syscall.shell.get_history', ({ resolve }) => {
            // Într-o implementare multi-shell, ar trebui să decidem de la care shell să luăm istoricul.
            // Momentan, îl vom partaja pe cel al primei instanțe (sau ultimul, depinde de timing).
            // Pentru independență totală, acest syscall ar trebui să includă un PID.
            resolve(this.commandHistory); 
        });

        logger.info(`Shell for PID ${this.pid}: Initialized.`);
        this.displayWelcomeMessage(); 
        this.updatePrompt();
    }

    displayWelcomeMessage() {
        const welcomeMessage = `Solus [Version 2.0] :: Terminal PID: ${this.pid}\nType 'help' for a list of available commands.\n`;
        this.terminal.write({ message: welcomeMessage });
    }

    updatePrompt() {
        this.terminal.showPrompt(this.currentDirectory);
    }

    async handleInput(value) {
        const commandString = value.trim();
        
        if (commandString) {
            this.commandHistory.push(commandString);
            this.historyIndex = this.commandHistory.length;

            const [commandName] = parseCommand(commandString);
            
            if (commandName === 'cd') {
                const [, targetPath = '/'] = parseCommand(commandString);
                const resolvedPath = resolvePath(this.currentDirectory, targetPath);
                try {
                    const stat = await syscall('vfs.stat', { path: resolvedPath });
                    if (stat.type !== 'directory') {
                        this.terminal.write({ message: `cd: not a directory: ${targetPath}`, isError: true });
                    } else {
                        this.currentDirectory = resolvedPath;
                    }
                } catch (e) {
                    this.terminal.write({ message: `cd: no such file or directory: ${targetPath}`, isError: true });
                }
                this.updatePrompt();
                return;
            }

            if (commandName === 'clear') {
                this.terminal.clear();
                this.updatePrompt();
                return;
            }

            const pipeline = parsePipeline(commandString);
            
            eventBus.emit('proc.exec', {
                pipeline,
                onOutput: (data) => eventBus.emit(`terminal.write.${this.pid}`, data),
                onExit: () => this.updatePrompt(),
                cwd: this.currentDirectory
            });
        } else {
            this.updatePrompt();
        }
    }

    handlePrevHistory() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.terminal.setInput(this.commandHistory[this.historyIndex]);
        }
    }

    handleNextHistory() {
        if (this.historyIndex < this.commandHistory.length) {
            const value = this.commandHistory[this.historyIndex] || '';
            this.terminal.setInput(value);
            this.historyIndex++;
        } else {
            this.historyIndex = this.commandHistory.length;
            this.terminal.setInput('');
        }
    }

    async handleAutocomplete(value) {
        const isNewSearch = value !== this.autocompleteSession.lastCompletedValue;

        if (isNewSearch) {
            this.autocompleteSession.currentIndex = 0;
            
            const lastPipeIndex = value.lastIndexOf('|');
            const segment = (lastPipeIndex === -1) ? value : value.substring(lastPipeIndex + 1);
            const wordsInSegment = segment.trim().split(/\s+/).filter(p => p.length > 0);

            if (wordsInSegment.length <= 1 && !value.endsWith(' ')) {
                this.autocompleteSession.contextType = 'command';
            } else {
                this.autocompleteSession.contextType = 'argument';
            }
            
            this.autocompleteSession.prefix = (lastPipeIndex === -1) ? '' : value.substring(0, lastPipeIndex + 1);
            this.autocompleteSession.baseSegment = segment;
            
            const wordToComplete = segment.trimStart().split(/\s+/).pop() || '';

            if (this.autocompleteSession.contextType === 'command') {
                this.autocompleteSession.matches = availableCommands.filter(name =>
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
                const searchPath = resolvePath(this.currentDirectory, basePath);
                try {
                    const entries = await syscall('vfs.readDir', { path: searchPath });
                    this.autocompleteSession.matches = entries
                        .filter(entry => entry.name.toLowerCase().startsWith(prefixPath.toLowerCase()))
                        .map(entry => {
                            let name = basePath + entry.name;
                            if (entry.type === 'directory') name += '/';
                            return name;
                        });
                } catch (e) {
                    this.autocompleteSession.matches = [];
                }
            }
        }

        if (this.autocompleteSession.matches.length === 0) {
            this.autocompleteSession.lastCompletedValue = null;
            return;
        }

        const currentMatch = this.autocompleteSession.matches[this.autocompleteSession.currentIndex];
        
        const base = this.autocompleteSession.baseSegment;
        let newValue;
        
        if (base.trim().includes(' ') || base.endsWith(' ')) {
            const parts = base.split(/\s+/);
            parts[parts.length - 1] = currentMatch;
            newValue = this.autocompleteSession.prefix + parts.join(' ');
        } else {
            newValue = this.autocompleteSession.prefix + currentMatch;
        }
        
        this.terminal.setInput(newValue);
        
        this.autocompleteSession.lastCompletedValue = newValue;
        this.autocompleteSession.currentIndex = (this.autocompleteSession.currentIndex + 1) % this.autocompleteSession.matches.length;
    }
}
fetchCommands(); 