// File: js/devices/terminal.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';

/**
 * Gestionează interfața utilizator și evenimentele pentru o singură instanță de terminal.
 * Independență completă de ID-uri statice și siguranță în runtime.
 */
export class Terminal {
  /**
   * @param {number} pid - Process ID-ul asociat cu această instanță de terminal.
   * @param {HTMLElement} rootElement - Elementul DOM rădăcină al terminalului.
   */
  constructor(pid, rootElement) {
    if (typeof pid !== 'number' || !Number.isFinite(pid)) {
      throw new TypeError('Invalid PID provided to Terminal');
    }
    if (!rootElement || !(rootElement instanceof HTMLElement)) {
      throw new TypeError(`[PID ${pid}] Terminal init failed: rootElement must be a valid HTMLElement.`);
    }

    this.pid = pid;
    this.shell = null;
    this.root = rootElement;

    try {
      this._setupDOM();
      this._bindEvents();
      this.input.focus();
      logger.info(`[PID ${this.pid}] Terminal initialized successfully.`);
    } catch (err) {
      logger.error(`[PID ${this.pid}] Terminal init failed:`, err?.message || err);
      throw err;
    }
  }

  /** Găsește și validează elementele DOM interne ale terminalului */
  _setupDOM() {
    this.output = this.root.querySelector('.terminal-output');
    this.inputLine = this.root.querySelector('.prompt-line');
    this.promptElement = this.root.querySelector('.prompt');
    this.input = this.root.querySelector('.terminal-input');

    if (!this.output || !this.inputLine || !this.promptElement || !this.input) {
      throw new Error(
        `[PID ${this.pid}] Terminal init failed: Missing required elements (.terminal-output, .prompt-line, .prompt, .terminal-input).`
      );
    }
  }

  /** Leagă toate evenimentele necesare terminalului */
  _bindEvents() {
    try {
      this._boundHandleKeyDown = this._handleKeyDown.bind(this);
      this._boundFocusInput = () => this.input.focus();
      this._boundWrite = (data) => this.write(data);
      this._boundSetTheme = (data) => this.setTheme(data);

      this.input.addEventListener('keydown', this._boundHandleKeyDown);
      this.root.addEventListener('click', this._boundFocusInput);

      eventBus.on(`terminal.write.${this.pid}`, this._boundWrite);
      eventBus.on('terminal.set_theme', this._boundSetTheme);

      logger.debug(`[PID ${this.pid}] Event listeners bound successfully.`);
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Failed to bind event listeners:`, err?.message || err);
    }
  }

  /** Curăță toate resursele și event listener-ele */
  destroy() {
    try {
      this.input?.removeEventListener('keydown', this._boundHandleKeyDown);
      this.root?.removeEventListener('click', this._boundFocusInput);

      eventBus.off(`terminal.write.${this.pid}`, this._boundWrite);
      eventBus.off('terminal.set_theme', this._boundSetTheme);

      logger.info(`[PID ${this.pid}] Terminal instance destroyed and event listeners removed.`);
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Terminal destroy() warning:`, err?.message || err);
    }
  }

  /** Conectează shell-ul asociat */
  connectShell(shellInstance) {
    this.shell = shellInstance;
    logger.debug(`[PID ${this.pid}] Shell connected.`);
  }

  /** Șterge complet conținutul terminalului */
  clear() {
    try {
      this.output.innerHTML = '';
      logger.debug(`[PID ${this.pid}] Terminal output cleared.`);
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Failed to clear terminal output:`, err?.message || err);
    }
  }

  /** Scrie o linie în terminal */
  write({ message, isError = false, isHtml = false }) {
    if (!message) return;

    try {
      const line = document.createElement('div');
      line.classList.add('terminal-line');
      if (isError) line.classList.add('error');

      if (isHtml) line.innerHTML = message;
      else line.textContent = message;

      this.output.appendChild(line);
      this.output.scrollTop = this.output.scrollHeight;

      logger.debug(`[PID ${this.pid}] Wrote message to terminal: "${message.slice(0, 80)}${message.length > 80 ? '...' : ''}"`);
    } catch (err) {
      logger.error(`[PID ${this.pid}] Failed to write to terminal:`, err?.message || err);
    }
  }

  /** Setează inputul curent */
  setInput(value) {
    try {
      this.input.value = value;
      this.input.focus();
      logger.debug(`[PID ${this.pid}] Input set to "${value}".`);
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Failed to set input:`, err?.message || err);
    }
  }

  /** Afișează promptul și pregătește terminalul pentru input nou */
  showPrompt(cwd) {
    try {
      this.promptElement.textContent = `user@webos:${cwd}$`;
      this.inputLine.style.visibility = 'visible';
      this.input.focus();
      this.output.scrollTop = this.output.scrollHeight;
      logger.debug(`[PID ${this.pid}] Prompt shown for cwd: ${cwd}`);
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Failed to show prompt:`, err?.message || err);
    }
  }

  /** Gestionarea tastelor din input */
  _handleKeyDown(e) {
    if (!this.shell) return;

    const command = this.input.value;
    try {
      switch (e.key) {
        case 'Enter':
          this.write({ message: `${this.promptElement.textContent} ${command}` });
          this.shell.handleInput(command);
          this.input.value = '';
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
          this.shell.handleAutocomplete(command);
          break;
      }
    } catch (err) {
      logger.error(`[PID ${this.pid}] Error handling key "${e.key}":`, err?.message || err);
    }
  }

  /** Schimbă tema vizuală */
  setTheme({ theme }) {
    try {
      const validThemes = [
        'nord-theme', 'dracula-theme', 'solarized-light-theme',
        'neon-blade-theme', 'matrix-green-theme', 'true-dark-theme'
      ];

      document.body.classList.remove(...validThemes);

      const themeClass = `${theme}-theme`;
      if (validThemes.includes(themeClass)) {
        document.body.classList.add(themeClass);
        logger.debug(`[PID ${this.pid}] Theme applied: ${themeClass}`);
      } else {
        logger.warn(`[PID ${this.pid}] Unknown theme "${theme}". No changes applied.`);
      }
    } catch (err) {
      logger.error(`[PID ${this.pid}] Failed to set theme:`, err?.message || err);
    }
  }
}
