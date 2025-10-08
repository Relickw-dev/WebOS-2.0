// File: js/devices/terminal.js (Corectat)
import { eventBus } from '../eventBus.js';

export class Terminal {
    constructor(pid, rootElement) {
        if (!rootElement) {
            console.error(`[PID ${pid}] Terminal init failed: root element must be provided.`);
            return;
        }

        this.pid = pid;
        this.shell = null; // Va fi conectat mai târziu

        // Căutăm elementele relativ la 'rootElement'
        this.output = rootElement.querySelector('#terminal-output');
        this.inputLine = rootElement.querySelector('#current-line');
        this.input = rootElement.querySelector('#terminal-input');
        this.promptElement = rootElement.querySelector('#prompt');
        
        // --- AICI ESTE CORECTURA ---
        // 'rootElement' este deja containerul principal al terminalului.
        this.terminalContainer = rootElement; 
        
        // Verificare de siguranță pentru a preveni erorile
        if (!this.output || !this.inputLine || !this.input || !this.promptElement) {
            console.error(`[PID ${pid}] Terminal init failed: One or more essential child elements are missing.`);
            return;
        }

        this.input.addEventListener('keydown', this._handleKeyDown.bind(this));
        this.terminalContainer.addEventListener('click', () => this.input.focus());

        // --- Listeneri de evenimente ---
        eventBus.on(`terminal.write.${this.pid}`, (data) => this.write(data));
        eventBus.on('terminal.set_theme', (data) => this.setTheme(data));
        
        this.input.focus();
    }

    connectShell(shellInstance) {
        this.shell = shellInstance;
    }

    clear() {
        if (this.output) this.output.innerHTML = '';
    }
    
    write({ message, isError = false, isHtml = false }) {
        if (!this.output) return;
        const line = document.createElement('div');
        line.classList.add('terminal-line');
        if (isError) line.classList.add('error');
        
        if (isHtml) {
            line.innerHTML = message;
        } else {
            line.textContent = message;
        }

        this.output.appendChild(line);
        this.output.scrollTop = this.output.scrollHeight;
    }

    setInput(value) {
        if (this.input) {
            this.input.value = value;
            this.input.focus();
        }
    }

    showPrompt(cwd) {
        if (this.promptElement) this.promptElement.textContent = `user@webos:${cwd}$`;
        if (this.inputLine) this.inputLine.style.visibility = 'visible';
        this.input.focus();
        this.output.scrollTop = this.output.scrollHeight;
    }

    _handleKeyDown(e) {
        if (!this.input || !this.shell) return;
        const value = this.input.value;

        switch (e.key) {
            case 'Enter':
                this.write({ message: `${this.promptElement.textContent} ${value}` });
                this.shell.handleInput(value);
                this.input.value = '';
                if(this.inputLine) this.inputLine.style.visibility = 'hidden';
                break;
            
            case 'ArrowUp':
                e.preventDefault();
                this.shell.handlePrevHistory();
                break;

            case 'ArrowDown':
                e.preventDefault();
                this.shell.handleNextHistory();
                break;

            case 'Tab':
                e.preventDefault();
                this.shell.handleAutocomplete(this.input.value);
                break;
        }
    }
    
    setTheme({ theme }) {
        const allThemeClasses = [
            'nord-theme',
            'dracula-theme',
            'solarized-light-theme',
            'neon-blade-theme',
            'matrix-green-theme',
            'true-dark-theme'
        ];
        document.body.classList.remove(...allThemeClasses);
        
        if (theme !== 'light' && allThemeClasses.includes(`${theme}-theme`)) {
             document.body.classList.add(`${theme}-theme`);
        }
    }
}