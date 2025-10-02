// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';
const commandHistory = [];
let historyIndex = 0;

function displayWelcomeMessage() {
    const welcomeArt = `
██╗    ██╗███████╗██████╗  ██████╗ ███████╗
██║    ██║██╔════╝██╔══██╗██╔═══██╗██╔════╝
██║ █╗ ██║█████╗  ██████╔╝██║   ██║███████╗
██║███╗██║██╔══╝  ██╔══██╗██║   ██║╚════██║
╚███╔███╔╝███████╗██████╔╝╚██████╔╝███████║
 ╚══╝╚══╝ ╚══════╝╚═════╝  ╚═════╝ ╚══════╝
    `;
    const welcomeMessage = `\nWelcome to WebOS 2.0. Type 'help' for a list of available commands.`;
    
    syscall('terminal.write', { message: welcomeArt });
    syscall('terminal.write', { message: welcomeMessage });
}
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

        logger.info('Shell: Initialized.');
        updatePrompt();
        displayWelcomeMessage(); 
    }
};

function updatePrompt() {
    document.getElementById('prompt').textContent = `user@webos:${currentDirectory}$`;
}

async function handleInput({ value }) {
    const commandString = value.trim();
    syscall('terminal.write', { message: commandString, isPrompt: true });
    
    if (commandString) {
        commandHistory.push(commandString);
        historyIndex = commandHistory.length;

        const [commandName, ...args] = commandString.split(' ');
        
        // --- LOGICA CD SIMPLIFICATĂ ȘI CORECTATĂ ---
        if (commandName === 'cd') {
            const targetPath = args.length > 0 ? args[0] : '/';

            // Cazuri speciale simple (rădăcină, acasă)
            if (targetPath === '/' || targetPath === '~') {
                currentDirectory = '/';
                updatePrompt();
                return;
            }

            const resolvedTargetPath = resolvePath(currentDirectory, targetPath);

            // Pentru 'cd ..' sau alte căi care se rezolvă la un director existent,
            // încercăm mai întâi o validare rapidă.
            if (targetPath.includes('..')) {
                 try {
                    const stat = await syscall('vfs.stat', { path: resolvedTargetPath });
                    if (stat && stat.type === 'dir') {
                        currentDirectory = resolvedTargetPath;
                        updatePrompt();
                        return;
                    }
                 } catch(e) { /* Ignorăm eroarea și lăsăm logica principală să ruleze */ }
            }

            // Logica principală: găsește părintele, listează și caută case-insensitive
            const pathParts = resolvedTargetPath.split('/').filter(p => p);
            const targetName = pathParts.pop() || '';
            const parentPath = '/' + pathParts.join('/');

            try {
                const parentEntries = await syscall('vfs.readDir', { path: parentPath });
                
                const match = parentEntries.find(entry => entry.name.toLowerCase() === targetName.toLowerCase());

                if (match && match.type === 'dir') {
                    // Succes! Construim calea finală cu numele corect.
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
        // --- SFÂRȘIT LOGICA CD ---

        if (commandName === 'clear') {
            syscall('terminal.clear');
            updatePrompt();
            return;
        }

        if (commandName === 'history') {
            // Formatăm istoricul comenzilor într-un singur string, cu fiecare comandă pe un rând nou
            const formattedHistory = commandHistory
                .map((cmd, index) => {
                    // Adăugăm numărul liniei, aliniat la dreapta pentru un aspect curat
                    const lineNumber = (index + 1).toString().padStart(4, ' ');
                    return `${lineNumber}  ${cmd}`;
                })
                .join('\n');

            // Afișăm istoricul formatat
            syscall('terminal.write', { message: formattedHistory });
            
            updatePrompt();
            return;
        }

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