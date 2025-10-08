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

        eventBus.on('terminal.set_theme', ({ theme }) => {
            const allThemeClasses = [
                'nord-theme',
                'dracula-theme',
                'solarized-light-theme',
                'neon-blade-theme',
                'matrix-green-theme',
                'true-dark-theme'
            ];
            document.body.classList.remove(...allThemeClasses);

            // Adăugăm clasa corespunzătoare, dacă nu este tema implicită 'light'.
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
            // Pentru tema 'light', nu se adaugă nicio clasă specială.
        });

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