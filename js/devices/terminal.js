// File: js/devices/terminal.js
import { eventBus } from '../eventBus.js';

export const terminal = {
    init() {
        this.output = document.getElementById('terminal-output');
        this.inputLine = document.getElementById('terminal-input-line');
        this.input = document.getElementById('terminal-input');
        this.promptElement = document.getElementById('prompt');

        // Ne asigurăm că elementele există înainte de a adăuga event listeners
        if (this.input) {
            this.input.addEventListener('keydown', this._handleKeyDown.bind(this));
        }

        // --- MODIFICARE AICI ---
        // Folosim selectorul corect, fie ID-ul '#terminal', fie clasa '.terminal-container'
        const terminalContainer = document.getElementById('terminal'); 
        if (terminalContainer) {
            terminalContainer.addEventListener('click', () => {
                if(this.input) this.input.focus();
            });
        }
        
        eventBus.on('terminal.write', (data) => this.write(data));
        eventBus.on('terminal.clear', () => this.clear());
        eventBus.on('terminal.set_input', ({ value }) => this.setInput(value));
        eventBus.on('terminal.prompt', ({ cwd }) => this.showPrompt(cwd));

        if(this.input) this.input.focus();
    },

    clear() {
        if(this.output) this.output.innerHTML = '';
    },
    
    write({ message, isError = false, isHtml = false }) {
        if (!this.output) return;
        const line = document.createElement('div');
        line.classList.add('terminal-line');
        if (isError) {
            line.classList.add('error');
        }
        
        if(isHtml) {
            line.innerHTML = message;
        } else {
            // Prevenim redarea HTML-ului dacă nu este specificat, pentru securitate
            line.textContent = message;
        }

        this.output.appendChild(line);
        this.output.scrollTop = this.output.scrollHeight;
    },

    setInput(value) {
        if(this.input) {
            this.input.value = value;
            this.input.focus();
        }
    },

    showPrompt(cwd) {
        if(this.promptElement) this.promptElement.textContent = `user@webos:${cwd}$`;
        if(this.inputLine) this.inputLine.style.visibility = 'visible';
        if(this.input) this.input.focus();
        if(this.output) this.output.scrollTop = this.output.scrollHeight;
    },

    _handleKeyDown(e) {
        if (!this.input) return;
        const value = this.input.value; // Trim se face în shell

        switch (e.key) {
            case 'Enter':
                this.write({ message: `${this.promptElement.textContent} ${value}` });
                eventBus.emit('shell.input', { value });
                this.input.value = '';
                if(this.inputLine) this.inputLine.style.visibility = 'hidden';
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
                eventBus.emit('shell.autocomplete', { value: this.input.value });
                break;
        }
    }
};