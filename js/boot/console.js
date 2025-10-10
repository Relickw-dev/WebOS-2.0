// File: js/boot/console.js (Versiune Corectă)

let state = {};
let outputElement, inputLineElement, inputElement;
const commandHistory = [];
let historyIndex = 0;

function logToConsole(message, isError = false) {
    if (!outputElement) return;
    const p = document.createElement('p');
    p.innerHTML = message;
    if (isError) p.style.color = '#ff4d4d';
    outputElement.appendChild(p);
    outputElement.scrollTop = outputElement.scrollHeight;
}

function enableConsolePrompt() {
    if (!inputLineElement || !inputElement) return;
    inputLineElement.style.visibility = 'visible';
    inputElement.focus();
}

async function handleConsoleCommand(commandString) {
    logToConsole(`<span style="color: #8b949e;">&gt; ${commandString}</span>`);
    const [command, ...args] = commandString.trim().split(/\s+/).filter(Boolean);

    switch (command) {
        case 'boot':
            if (args[0]) {
                const bootFailed = await state.executeBoot(args[0]) === false;
                // Dacă executeBoot a returnat 'false', înseamnă că a eșuat
                if (bootFailed) {
                    enableConsolePrompt(); // Reactivăm prompt-ul la eșec
                }
            } else {
                logToConsole("Usage: boot &lt;path_to_init_script&gt;", true);
                enableConsolePrompt(); // Reactivăm prompt-ul dacă nu există argumente
            }
            break;
        case 'reboot':
            logToConsole('Rebooting system...');
            setTimeout(() => window.location.reload(), 500);
            // Nu reactivăm prompt-ul aici
            break;
        case 'cls':
        case 'clear':
            outputElement.innerHTML = '';
            enableConsolePrompt(); // Reactivăm prompt-ul
            break;
        case 'help':
            logToConsole("Available commands: boot, reboot, cls, help.");
            enableConsolePrompt(); // Reactivăm prompt-ul
            break;
        case '': // Ignoră Enter-ul gol
            enableConsolePrompt(); // Reactivăm prompt-ul
            break;
        default:
            logToConsole(`Unknown command: ${command}`, true);
            enableConsolePrompt(); // Reactivăm prompt-ul
            break;
    }
}

export function switchToConsoleMode(initialState, error) {
    state = initialState;
    state.UIMode = 'console';
    
    clearInterval(state.countdownInterval);

    const contentArea = document.getElementById('boot-content');
    if (!contentArea) {
        // Acest mesaj nu ar trebui să mai apară acum
        console.error("Critical Error: Boot panel content area could not be found for console switch.");
        document.body.innerHTML = "A critical error occurred. Please refresh.";
        return;
    }

    contentArea.innerHTML = `
        <div id="recovery-console">
            <div id="boot-output"></div>
            <div id="boot-input-line" style="visibility: hidden;">
                <span id="boot-prompt">RECOVERY&gt; </span>
                <input type="text" id="boot-input" autocomplete="off" spellcheck="false" />
            </div>
        </div>
    `;

    const headerTitle = document.querySelector('#boot-header h1');
    if (headerTitle) headerTitle.textContent = "Recovery Mode";
    
    state.footerText.innerHTML = `<span style="color: #ff4d4d;">A boot error occurred. Manual intervention required.</span>`;
    state.progressBar.style.width = '100%';
    state.progressBar.style.backgroundColor = '#ff4d4d';

    outputElement = document.getElementById('boot-output');
    inputLineElement = document.getElementById('boot-input-line');
    inputElement = document.getElementById('boot-input');
    
    logToConsole('SYSTEM HALTED: Entering recovery console.');
    logToConsole(`Error: <span style="color:#ffaeae;">${error.message}</span>`);
    logToConsole("--------------------------------------------------");
    logToConsole("Type 'boot /js/init.js' to attempt a manual boot, or 'help' for commands.");
    enableConsolePrompt();
}

export function consoleKeydownHandler(key, e) {
    if (key === 'Enter') {
        const command = inputElement.value;
        if (command) commandHistory.push(command);
        historyIndex = commandHistory.length;
        inputElement.value = '';
        inputLineElement.style.visibility = 'hidden';
        handleConsoleCommand(command);
    } else if (key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex--; inputElement.value = commandHistory[historyIndex]; }
    } else if (key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) { historyIndex++; inputElement.value = commandHistory[historyIndex]; }
        else { historyIndex = commandHistory.length; inputElement.value = ''; }
    }
}