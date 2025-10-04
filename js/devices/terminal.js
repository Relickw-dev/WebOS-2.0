// File: js/devices/terminal.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

const terminal = {
    init: () => {
        const output = document.getElementById('terminal-output');
        const input = document.getElementById('terminal-input');
        const promptSpan = document.getElementById('prompt');
        const themeLink = document.getElementById('theme-link'); // NOU

        if (!output || !input || !promptSpan || !themeLink) { // MODIFICARE
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

        // Listener nou: setează valoarea input-ului și mută cursorul la final
        eventBus.on('terminal.set_input', ({ value }) => {
            input.value = value;
            input.focus();
            input.setSelectionRange(value.length, value.length);
        });

        // NOU: Listener pentru schimbarea temei
        eventBus.on('terminal.set_theme', ({ path }) => {
            themeLink.href = path;
            logger.info(`Terminal theme changed to ${path}`);
        });

        // Listener `keydown` actualizat pentru a gestiona mai multe taste
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
    
};

export default terminal;