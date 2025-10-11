// File: js/bootloader.js (Optimized and Cleaned)

// =================================================================================================
// # IMPORTS
// =================================================================================================

import { parseConfig, checkServerStatus } from './boot/utils.js';
import { initGraphicalUI, graphicalKeydownHandler } from './boot/ui.js';
import { switchToConsoleMode, consoleKeydownHandler } from './boot/console.js';

// =================================================================================================
// # CENTRALIZED STATE (STATE MANAGEMENT)
// =================================================================================================

/**
 * The centralized object that maintains the state of the entire boot process.
 * @property {object} bootConfig - The parsed configuration from boot.config.
 * @property {number|null} countdownInterval - The interval ID for the boot countdown timer.
 * @property {number} selectedEntryIndex - The index of the selected boot option in the menu.
 * @property {HTMLElement|null} uiContainer - The main element that contains the entire bootloader interface.
 * @property {HTMLElement|null} selectionIndicator - The visual indicator for the selected option.
 * @property {HTMLElement|null} infoPanel - The panel where boot option details are displayed.
 * @property {HTMLElement|null} progressBar - The progress bar for the countdown timer.
 * @property {HTMLElement|null} footerText - The text area in the footer.
 * @property {'graphical'|'console'|'booted'} UIMode - The current mode of the interface.
 * @property {function} executeBoot - A reference to the main boot function to be passed to other modules.
 */
const state = {
    bootConfig: {},
    countdownInterval: null,
    selectedEntryIndex: 0,
    uiContainer: null,
    selectionIndicator: null,
    infoPanel: null,
    progressBar: null,
    footerText: null,
    UIMode: 'graphical',
    executeBoot: executeBoot, // We keep the reference so it can be called from other modules (e.g., console.js)
};

// =================================================================================================
// # CORE BOOT LOGIC
// =================================================================================================

/**
 * The main function that orchestrates the startup of the entire bootloader.
 */
async function startBootloader() {
    window.addEventListener('keydown', globalKeydownHandler);

    try {
        const response = await fetch('/boot.config');
        if (!response.ok) {
            throw new Error(`boot.config not found (HTTP ${response.status})`);
        }

        state.bootConfig = parseConfig(await response.text());

        // Attempt to execute Fast Boot if it is enabled
        if (state.bootConfig.FAST_BOOT === 'true') {
            const defaultKey = state.bootConfig.DEFAULT;
            const defaultEntry = state.bootConfig.entries?.[defaultKey];

            if (defaultEntry && defaultEntry.INIT_PATH) {
                await executeBoot(defaultEntry.INIT_PATH);
                return; // Stop execution if fast boot started successfully
            } else {
                throw new Error('Fast Boot enabled, but default entry is invalid or missing.');
            }
        }

        // If Fast Boot is not active or has failed, build the graphical interface
        buildAndInitializeUI();

    } catch (error) {
        // Handle any error that occurred during initialization
        handleBootError(error);
    }
}

/**
 * Executes the booting process for a given script path.
 * @param {string} path - The path to the initialization script (e.g., /js/init.js).
 * @returns {Promise<boolean|undefined>} Returns 'false' on failure, otherwise returns nothing on success.
 */
async function executeBoot(path) {
    
    if (state.uiContainer) {
        state.uiContainer.style.transition = 'opacity 0.5s ease-out';
        state.uiContainer.style.opacity = '0';
    }

    if (!await checkServerStatus()) {
        handleBootError(new Error("Backend server connection failed."));
        return false;
    }

    try {
        const initModule = await import(path);
        if (initModule && typeof initModule.startSystem === 'function') {
            const delay = state.uiContainer ? 500 : 0; // Wait for the fade-out animation to complete

            setTimeout(async () => {
                await initModule.startSystem();
                cleanupBootloader(); // Clean up bootloader resources after a successful start
            }, delay);
        } else {
            throw new Error('`startSystem` function not found in init script.');
        }
    } catch (error) {
        handleBootError(new Error(`Could not load init script: ${error.message}`));
        return false;
    }
}

// =================================================================================================
// # UI MANAGEMENT
// =================================================================================================

/**
 * Builds the basic structure of the bootloader interface and adds it to the DOM.
 */
function buildBootUI() {
    state.uiContainer = document.createElement('div');
    state.uiContainer.id = 'bootloader-ui';
    state.uiContainer.innerHTML = `
        <div id="boot-panel">
            <header id="boot-header"><h1>Solus Boot Manager</h1><span id="boot-timestamp"></span></header>
            <main id="boot-content"></main>
            <footer id="boot-footer">
                <div id="progress-bar-container"><div id="progress-bar"></div></div>
                <div id="boot-footer-text">Initializing...</div>
            </footer>
        </div>
    `;
    document.body.appendChild(state.uiContainer);

    // Save references to the created elements
    state.progressBar = document.getElementById('progress-bar');
    state.footerText = document.getElementById('boot-footer-text');
    document.getElementById('boot-timestamp').textContent = new Date().toUTCString();
}

/**
 * Fully initializes the graphical interface, including the boot menu.
 */
function buildAndInitializeUI() {
    buildBootUI();

    if (state.bootConfig.entries && Object.keys(state.bootConfig.entries).length > 0) {
        document.getElementById('boot-content').innerHTML = `
            <div id="boot-menu"><div id="selection-indicator"><span>[</span><span>]</span></div></div>
            <div id="info-panel"></div>
        `;
        state.selectionIndicator = document.getElementById('selection-indicator');
        state.infoPanel = document.getElementById('info-panel');
        initGraphicalUI(state);
    } else {
        throw new Error('boot.config is empty or has no valid entries.');
    }
}

/**
 * Handles errors that occur, creating the interface if it doesn't exist and switching to console mode.
 * @param {Error} error - The error object.
 */
async function handleBootError(error) {
    if (!state.uiContainer) {
        // If the UI was not created at all (e.g., error during fast boot), we create it now
        await createAndSwitchToConsole(error);
    } else {
        // If the UI already exists, just display the error and switch the mode
        state.uiContainer.style.opacity = '1';
        switchToConsoleMode(state, error);
        const errorTarget = state.footerText || document.querySelector('#boot-output');
        if (errorTarget) {
            errorTarget.innerHTML = `<p style="color: #ff4d4d;">FATAL: ${error.message}</p>`;
        }
    }
}


/**
 * A specialized helper function for errors that occur before the UI is created.
 * @param {Error} error - The error object.
 */
async function createAndSwitchToConsole(error) {
    buildBootUI(); // Build the basic structure
    const headerTitle = document.querySelector('#boot-header h1');
    if(headerTitle) headerTitle.textContent = "Recovery Mode";

    switchToConsoleMode(state, error); // Switch to console mode
}

/**
 * Cleans up bootloader resources after the operating system has successfully started.
 */
function cleanupBootloader() {
    state.UIMode = 'booted'; // Change the state to disable the listener
    window.removeEventListener('keydown', globalKeydownHandler); // Remove the listener
    if (state.uiContainer) {
        state.uiContainer.remove(); // Remove the interface from the DOM
    }
}


// =================================================================================================
// # EVENT HANDLING
// =================================================================================================

/**
 * The global handler for the 'keydown' event.
 * Manages navigation in the graphical menu or input in the recovery console.
 * @param {KeyboardEvent} e - The keyboard event.
 */
function globalKeydownHandler(e) {
    if (state.UIMode === 'graphical') {
        if (!state.bootConfig.entries || Object.keys(state.bootConfig.entries).length === 0) return;

        clearInterval(state.countdownInterval);
        state.progressBar.style.transition = 'width 0.2s ease';
        state.progressBar.style.width = '100%';
        state.footerText.innerHTML = 'Use <span>[↑↓]</span> to Navigate, <span>[Enter]</span> to Boot.';

        const entryCount = Object.keys(state.bootConfig.entries).length;
        const keyHandlers = {
            'ArrowUp': () => { state.selectedEntryIndex = (state.selectedEntryIndex - 1 + entryCount) % entryCount; graphicalKeydownHandler.update(); },
            'ArrowDown': () => { state.selectedEntryIndex = (state.selectedEntryIndex + 1) % entryCount; graphicalKeydownHandler.update(); },
            'Enter': () => { graphicalKeydownHandler.boot(); }
        };

        if (keyHandlers[e.key]) {
            e.preventDefault();
            keyHandlers[e.key]();
        }
    } else if (state.UIMode === 'console') {
        consoleKeydownHandler(e.key, e);
    }
}

// =================================================================================================
// # INITIALIZATION
// =================================================================================================

window.addEventListener('DOMContentLoaded', startBootloader);