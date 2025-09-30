// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';

let currentDirectory = '/';

export const shell = {
    init: () => {
        eventBus.on('kernel.boot_complete', () => {
            document.getElementById('terminal-input').focus();
            updatePrompt();
        });
        eventBus.on('shell.input', handleInput);
        logger.info('Shell: Initialized.');
    }
};

function updatePrompt() {
    document.getElementById('prompt').textContent = `user@webos:${currentDirectory}$`;
}

function handleInput({ value }) {
    const commandString = value.trim();
    syscall('terminal.write', { message: commandString, isPrompt: true });
    
    if (commandString) {
        const [commandName, ...args] = commandString.split(' ');
        
        // Comenzi interne
        if (commandName === 'cd') {
            // Logica pentru 'cd' rămâne aici, deoarece modifică starea shell-ului (currentDirectory)
            const targetPath = args.length > 0 ? args[0] : '/';
            // TODO: Implementează logica de rezolvare a căii și de validare cu vfs.stat
            // Pentru moment, doar actualizează calea
            currentDirectory = targetPath;
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