// File: js/devices/terminal.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

const terminal = {

    init: () => {
        const output = document.getElementById('terminal-output');
        const input = document.getElementById('terminal-input');
        const promptSpan = document.getElementById('prompt');
        if (!output || !input || !promptSpan ) {
            logger.error('Terminal elements not found.');
            return;
        }

        eventBus.on('terminal.write', (data) => {
            const element = document.createElement('div');
            if (data.isPrompt) {
                element.innerHTML = `<span class="prompt">${promptSpan.textContent}</span> ${data.message}`;
            } else {
                element.innerHTML = data.message.replace(/\n/g, '<br>');
                if (data.type === 'error') {
                    element.classList.add('error');
                }
            }
            output.appendChild(element);
            output.scrollTop = output.scrollHeight;
        });

        eventBus.on('terminal.clear', () => {
            output.innerHTML = '';
        });

        eventBus.on('terminal.set_input', ({ value }) => {
            input.value = value;
            input.focus();
            input.setSelectionRange(value.length, value.length);
        });
        
        eventBus.on('terminal.set_theme', ({ theme }) => {
            const allThemeClasses = [
            'nord-theme', 
            'true-dark-theme',
            'dracula-theme', 
            'solarized-light-theme',
            'neon-blade-theme',   
            'matrix-green-theme'  
        ];
            document.body.classList.remove(...allThemeClasses);
            if (theme === 'nord') {
                document.body.classList.add('nord-theme');
            } else if (theme === 'dracula') {
                document.body.classList.add('dracula-theme');
            } else if (theme === 'solarized-light') {
                document.body.classList.add('solarized-light-theme');
            } else if (theme === 'neon-blade') {
                document.body.classList.add('neon-blade-theme');
            } else if (theme === 'matrix-green') {
                document.body.classList.add('matrix-green-theme');
            } else if (theme === 'true-dark') {
                document.body.classList.add('true-dark-theme');
            }
        });

        input.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    eventBus.emit('shell.input', { value: input.value });
                    input.value = '';
                    break;
                
                case 'ArrowUp':
                    e.preventDefault();
                    eventBus.emit('shell.history.prev');
                    break;
                    
                case 'ArrowDown':
                    e.preventDefault();
                    eventBus.emit('shell.history.next');
                    break;

                case 'Tab':
                    e.preventDefault();
                    eventBus.emit('shell.autocomplete', { value: input.value });
                    break;
            }
        });
        logger.info('Terminal Driver: Initialized.');
    }
}

export default terminal;