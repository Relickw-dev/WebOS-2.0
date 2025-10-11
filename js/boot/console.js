// File: js/boot/console.js (Optimized and Cleaned)

// =================================================================================================
// # MODULE STATE & VARIABLES
// =================================================================================================

/** The global state of the bootloader, passed from the orchestrator. */
let state = {};

// References to the console's DOM elements
let outputElement, inputLineElement, inputElement;

/** The history of commands entered into the console. */
const commandHistory = [];
let historyIndex = 0;

// =================================================================================================
// # EXPORTED FUNCTIONS (Public API)
// =================================================================================================

/**
 * Switches the bootloader interface to recovery console mode.
 * This function builds the console UI, displays the error, and prepares the prompt for input.
 * @param {object} initialState - The centralized state object from bootloader.js.
 * @param {Error} error - The error object that triggered the entry into recovery mode.
 */
export function switchToConsoleMode(initialState, error) {
    state = initialState;
    state.UIMode = 'console';

    clearInterval(state.countdownInterval);

    const contentArea = document.getElementById('boot-content');
    if (!contentArea) {
        console.error("Critical Error: #boot-content area not found for console switch.");
        document.body.innerHTML = "A critical error occurred. Please refresh.";
        return;
    }

    // Modify global UI elements to reflect the "Recovery Mode" state
    updateGlobalUIForRecovery();

    // Build the HTML structure of the console
    contentArea.innerHTML = `
        <div id="recovery-console">
            <div id="boot-output"></div>
            <div id="boot-input-line" style="visibility: hidden;">
                <span id="boot-prompt">RECOVERY&gt; </span>
                <input type="text" id="boot-input" autocomplete="off" spellcheck="false" />
            </div>
        </div>
    `;

    // Save references to the new DOM elements
    outputElement = document.getElementById('boot-output');
    inputLineElement = document.getElementById('boot-input-line');
    inputElement = document.getElementById('boot-input');

    // Display the initial messages in the console
    logInitialMessages(error);
    enableConsolePrompt();
}

/**
 * Handles keyboard events when the console is active.
 * @param {string} key - The key that was pressed (e.g., 'Enter', 'ArrowUp').
 * @param {KeyboardEvent} e - The original keyboard event.
 */
export function consoleKeydownHandler(key, e) {
    switch (key) {
        case 'Enter':
            const command = inputElement.value;
            if (command) {
                commandHistory.push(command);
            }
            historyIndex = commandHistory.length;
            inputElement.value = '';
            inputLineElement.style.visibility = 'hidden';
            handleConsoleCommand(command);
            break;

        case 'ArrowUp':
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                inputElement.value = commandHistory[historyIndex];
            }
            break;

        case 'ArrowDown':
            e.preventDefault();
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++;
                inputElement.value = commandHistory[historyIndex];
            } else {
                historyIndex = commandHistory.length;
                inputElement.value = '';
            }
            break;
    }
}


// =================================================================================================
// # COMMAND HANDLING LOGIC
// =================================================================================================

/**
 * Parses and executes a command entered by the user.
 * @param {string} commandString - The raw command string from the input.
 */
async function handleConsoleCommand(commandString) {
    logToConsole(`<span style="color: #8b949e;">&gt; ${commandString}</span>`);
    const [command, ...args] = commandString.trim().split(/\s+/).filter(Boolean);

    const commandHandler = commandActions[command] || commandActions.default;
    await commandHandler(args);

    // Re-enable the prompt for most commands, except for those that don't require it (e.g., reboot).
    if (command !== 'reboot') {
        enableConsolePrompt();
    }
}

/**
 * An object that maps command names to their corresponding functions.
 * This structure is cleaner and more easily extensible than a switch statement.
 */
const commandActions = {
    'boot': async (args) => {
        if (!args[0]) {
            logToConsole("Usage: boot &lt;path_to_init_script&gt;", true);
            return;
        }
        // Await the execution result. `executeBoot` returns `false` on failure.
        const bootFailed = await state.executeBoot(args[0]) === false;
        if (!bootFailed) {
            // Hide the prompt only if the boot starts successfully
            inputLineElement.style.visibility = 'hidden';
        }
    },
    'reboot': () => {
        logToConsole('Rebooting system...');
        setTimeout(() => window.location.reload(), 500);
    },
    'cls': () => {
        if (outputElement) outputElement.innerHTML = '';
    },
    'clear': () => commandActions.cls(), // Alias for 'cls'
    'help': () => {
        logToConsole("Available commands: boot, reboot, cls, clear, help.");
    },
    '': () => {
        // Ignore empty command (just pressing Enter)
    },
    'default': ([cmd]) => {
        logToConsole(`Unknown command: ${cmd}`, true);
    }
};


// =================================================================================================
// # UI/DOM HELPER FUNCTIONS
// =================================================================================================

/**
 * Displays a message in the console's output panel.
 * @param {string} message - The HTML message to be displayed.
 * @param {boolean} [isError=false] - If true, the message will be colored as an error.
 */
function logToConsole(message, isError = false) {
    if (!outputElement) return;
    const p = document.createElement('p');
    p.innerHTML = message;
    if (isError) {
        p.style.color = '#ff4d4d';
    }
    outputElement.appendChild(p);
    outputElement.scrollTop = outputElement.scrollHeight; // Auto-scroll to the latest message
}

/**
 * Enables and focuses the console's input field.
 */
function enableConsolePrompt() {
    if (!inputLineElement || !inputElement) return;
    inputLineElement.style.visibility = 'visible';
    inputElement.focus();
}

/**
 * Modifies the main UI elements (header, footer) to signal recovery mode.
 */
function updateGlobalUIForRecovery() {
    const headerTitle = document.querySelector('#boot-header h1');
    if (headerTitle) {
        headerTitle.textContent = "Recovery Mode";
    }
    if (state.footerText) {
        state.footerText.innerHTML = `<span style="color: #ff4d4d;">A boot error occurred. Manual intervention required.</span>`;
    }
    if (state.progressBar) {
        state.progressBar.style.width = '100%';
        state.progressBar.style.backgroundColor = '#ff4d4d';
    }
}

/**
 * Displays the initial messages upon entering recovery mode.
 * @param {Error} error - The error object.
 */
function logInitialMessages(error) {
    logToConsole('SYSTEM HALTED: Entering recovery console.');
    logToConsole(`Error: <span style="color:#ffaeae;">${error.message}</span>`);
    logToConsole("--------------------------------------------------");
    logToConsole("Type 'boot /js/init.js' to attempt a manual boot, or 'help' for commands.");
}