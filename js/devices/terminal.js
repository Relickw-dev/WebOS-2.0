// File: js/devices/terminal.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

const terminal = {
    init: () => {
        const output = document.getElementById('terminal-output');
        const input = document.getElementById('terminal-input');
        const promptSpan = document.getElementById('prompt');

        if (!output || !input || !promptSpan) {
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

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                eventBus.emit('shell.input', { value: input.value });
                input.value = '';
            }
        });
        
        logger.info('Terminal Driver: Initialized.');
    }
};

export default terminal;