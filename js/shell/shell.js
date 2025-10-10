// File: js/shell/shell.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { syscall } from '../kernel/syscalls.js';
import { resolvePath } from '../utils/path.js';

// ===============================
// 🔧 Helper Functions & Globals
// ===============================

let availableCommands = [];
let commandsFetched = false;

/** Preia lista de comenzi din API sau folosește fallback local */
async function fetchCommands() {
  if (commandsFetched) return;

  try {
    const response = await fetch('http://localhost:3000/api/commands');
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

    const commandsFromServer = await response.json();
    const builtInCommands = ['cd', 'clear', 'chmod', 'su'];
    availableCommands = [...new Set([...commandsFromServer, ...builtInCommands])];
    logger.info(`Shell: Loaded ${availableCommands.length} commands from API.`);
  } catch (error) {
    logger.error(`Shell: Failed to fetch commands (${error.message}). Using fallback list.`);
    availableCommands = [
      'cat', 'cd', 'clear', 'chmod', 'cp', 'date', 'echo', 'grep', 'head', 'help',
      'history', 'kill', 'ls', 'mkdir', 'mv', 'ps', 'pwd', 'rm', 'sleep', 'stat',
      'su', 'theme', 'touch', 'wc'
    ];
  }

  commandsFetched = true;
}

/** Parsează un string de comandă în argumente */
function parseCommand(commandString) {
  const parts = commandString.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  return parts.map(p =>
    (p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))
      ? p.slice(1, -1)
      : p
  );
}

/** Descompune o comandă complexă cu pipes/redirecționări într-un pipeline executabil */
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
      outputFile = parts[1]?.split(' ')[0];
      stdout = 'file';
      append = true;
    } else if (commandStr.includes('>')) {
      const parts = commandStr.split('>').map(p => p.trim());
      commandStr = parts[0];
      outputFile = parts[1]?.split(' ')[0];
      stdout = 'file';
    }

    const [name, ...args] = parseCommand(commandStr);
    if (!name) continue;

    pipeline.push({ name, args, stdout, outputFile, append });
  }

  // Marchează comenzile intermediare ca având stdout -> pipe
  for (let i = 0; i < pipeline.length - 1; i++) {
    pipeline[i].stdout = 'pipe';
  }

  return pipeline;
}

// ===============================
// 🧠 Shell Class Definition
// ===============================

export class Shell {
  constructor(terminalInstance) {
    if (!terminalInstance) {
      throw new Error('Shell: Missing required terminal instance.');
    }

    this.terminal = terminalInstance;
    this.pid = terminalInstance.pid;

    this.currentDirectory = '/';
    this.currentUser = 'user'; // 🆕 Context de utilizator

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

    this.init();
  }

  // ===========================
  // 🚀 Initialization
  // ===========================
  async init() {
    try {
      await fetchCommands();

      eventBus.on('syscall.shell.get_history', ({ resolve }) => {
        resolve(this.commandHistory);
      });

      logger.info(`[PID ${this.pid}] Shell initialized for user '${this.currentUser}'.`);
      this.displayWelcomeMessage();
      this.updatePrompt();
    } catch (err) {
      logger.error(`[PID ${this.pid}] Shell init failed:`, err?.message || err);
    }
  }

  // ===========================
  // 💬 UI Helpers
  // ===========================
  displayWelcomeMessage() {
    const msg = `Solus [Version 2.0] :: Terminal PID: ${this.pid}\n` +
                `Logged in as '${this.currentUser}'. Type 'help' for commands.\n`;
    this.terminal.write({ message: msg });
  }

  updatePrompt() {
    try {
      const prompt = `${this.currentUser}@webos:${this.currentDirectory}$`;
      this.terminal.promptElement.textContent = prompt;
      this.terminal.inputLine.style.visibility = 'visible';
      this.terminal.input.focus();
      this.terminal.output.scrollTop = this.terminal.output.scrollHeight;
    } catch (err) {
      logger.warn(`[PID ${this.pid}] Failed to update prompt:`, err?.message || err);
    }
  }

  // ===========================
  // ⌨️ Input Handling
  // ===========================
  async handleInput(value) {
    this.terminal.inputLine.style.visibility = 'hidden';
    const commandString = value.trim();

    if (!commandString) {
      this.updatePrompt();
      return;
    }

    this.commandHistory.push(commandString);
    this.historyIndex = this.commandHistory.length;

    const [commandName] = parseCommand(commandString);

    try {
      switch (commandName) {
        case 'cd':
          await this._handleCd(commandString);
          break;

        case 'clear':
          this.terminal.clear();
          this.updatePrompt();
          break;

        case 'su':
          await this._handleSu(commandString);
          break;

        default:
          await this._executePipeline(commandString);
      }
    } catch (err) {
      logger.error(`[PID ${this.pid}] Command execution error:`, err?.message || err);
      this.terminal.write({ message: `Error: ${err.message}`, isError: true });
      this.updatePrompt();
    }
  }

  // ===========================
  // 🧩 Command Handlers
  // ===========================
  async _handleCd(commandString) {
    const [, targetPath = '/'] = parseCommand(commandString);
    const resolved = resolvePath(this.currentDirectory, targetPath);

    try {
      const stat = await syscall('vfs.stat', { path: resolved, user: this.currentUser });
      if (stat.type !== 'directory') {
        this.terminal.write({ message: `cd: not a directory: ${targetPath}`, isError: true });
      } else {
        this.currentDirectory = resolved;
      }
    } catch (e) {
      this.terminal.write({
        message: `cd: ${e.message.includes('such file') ? 'no such file or directory' : e.message}: ${targetPath}`,
        isError: true
      });
    }

    this.updatePrompt();
  }

  async _handleSu(commandString) {
    const [, newUser = 'user'] = parseCommand(commandString);
    this.currentUser = newUser;
    this.terminal.write({ message: `User changed to '${this.currentUser}'.` });
    logger.info(`[PID ${this.pid}] User switched to '${this.currentUser}'.`);
    this.updatePrompt();
  }

  async _executePipeline(commandString) {
    const pipeline = parsePipeline(commandString);

    eventBus.emit('proc.exec', {
      pipeline,
      cwd: this.currentDirectory,
      user: this.currentUser,
      onOutput: (data) => eventBus.emit(`terminal.write.${this.pid}`, data),
      onExit: () => this.updatePrompt()
    });

    logger.debug(`[PID ${this.pid}] Executed pipeline: ${commandString}`);
  }

  // ===========================
  // ⏪ History Navigation
  // ===========================
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

  // ===========================
  // 🔍 Autocomplete
  // ===========================
  async handleAutocomplete(value) {
    const isNewSearch = value !== this.autocompleteSession.lastCompletedValue;

    if (isNewSearch) {
      await this._prepareAutocomplete(value);
    }

    if (!this.autocompleteSession.matches.length) {
      this.autocompleteSession.lastCompletedValue = null;
      return;
    }

    const match = this.autocompleteSession.matches[this.autocompleteSession.currentIndex];
    const base = this.autocompleteSession.baseSegment;
    const prefix = this.autocompleteSession.prefix;

    const parts = base.split(/\s+/);
    parts[parts.length - 1] = match;
    const newValue = prefix + parts.join(' ');

    this.terminal.setInput(newValue);
    this.autocompleteSession.lastCompletedValue = newValue;
    this.autocompleteSession.currentIndex =
      (this.autocompleteSession.currentIndex + 1) % this.autocompleteSession.matches.length;
  }

  async _prepareAutocomplete(value) {
    this.autocompleteSession.currentIndex = 0;

    const lastPipeIndex = value.lastIndexOf('|');
    const segment = lastPipeIndex === -1 ? value : value.substring(lastPipeIndex + 1);
    const words = segment.trim().split(/\s+/).filter(Boolean);

    this.autocompleteSession.contextType =
      words.length <= 1 && !value.endsWith(' ') ? 'command' : 'argument';
    this.autocompleteSession.prefix = lastPipeIndex === -1 ? '' : value.substring(0, lastPipeIndex + 1);
    this.autocompleteSession.baseSegment = segment;

    const wordToComplete = segment.trimStart().split(/\s+/).pop() || '';

    if (this.autocompleteSession.contextType === 'command') {
      this.autocompleteSession.matches = availableCommands.filter(name =>
        name.toLowerCase().startsWith(wordToComplete.toLowerCase())
      );
    } else {
      const lastSlash = wordToComplete.lastIndexOf('/');
      const basePath = lastSlash !== -1 ? wordToComplete.slice(0, lastSlash + 1) : '';
      const prefix = lastSlash !== -1 ? wordToComplete.slice(lastSlash + 1) : '';
      const searchPath = resolvePath(this.currentDirectory, basePath);

      try {
        const entries = await syscall('vfs.readDir', { path: searchPath, user: this.currentUser });
        this.autocompleteSession.matches = entries
          .filter(e => e.name.toLowerCase().startsWith(prefix.toLowerCase()))
          .map(e => (e.type === 'directory' ? `${basePath}${e.name}/` : `${basePath}${e.name}`));
      } catch {
        this.autocompleteSession.matches = [];
      }
    }
  }
}

// Pre-fetch pentru a accelera prima instanță
fetchCommands();
