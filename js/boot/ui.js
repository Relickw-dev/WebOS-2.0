// File: js/boot/ui.js (Optimized and Cleaned)

// =================================================================================================
// # IMPORTS
// =================================================================================================

import { generateChecksum } from './utils.js';

// =================================================================================================
// # MODULE STATE
// =================================================================================================

/**
 * A reference to the bootloader's centralized state object.
 * @type {object}
 */
let state = {};

// =================================================================================================
// # MAIN INITIALIZATION FUNCTION (Public API)
// =================================================================================================

/**
 * Initializes and displays the graphical user interface of the bootloader.
 * @param {object} initialState - The centralized state passed from bootloader.js.
 */
export function initGraphicalUI(initialState) {
    state = initialState;

    setupInitialSelection();
    buildBootMenu();
    startCountdown();

    // Update the UI on the first animation frame to ensure correct positioning.
    requestAnimationFrame(updateMenuSelection);
}

// =================================================================================================
// # BOOT LOGIC
// =================================================================================================

/**
 * Initiates the boot process for the selected entry.
 */
function bootSelectedEntry() {
    clearInterval(state.countdownInterval);

    const entryKeys = Object.keys(state.bootConfig.entries);
    const selectedKey = entryKeys[state.selectedEntryIndex];
    const selectedEntry = state.bootConfig.entries[selectedKey];

    if (selectedKey === 'reboot') {
        state.footerText.textContent = 'Rebooting system...';
        state.progressBar.style.transition = 'none';
        state.progressBar.style.width = '100%';
        setTimeout(() => window.location.reload(), 500); // Wait 500ms before reloading
    } else if (selectedKey === 'shutdown') {
    state.footerText.textContent = 'System is shutting down...';
    state.progressBar.style.width = '100%';
    // Ascunde meniul și afișează un mesaj final
    setTimeout(() => {
        document.body.innerHTML = '<div style="color: black; text-align: center; padding-top: 20%;">It is now safe to close this tab.</div>';
    }, 500)
    // === ELSE, continue with the normal boot process ===
    } else if (selectedEntry && selectedEntry.INIT_PATH) {
        state.footerText.textContent = `Booting '${selectedEntry.DESCRIPTION}'...`;
        state.progressBar.style.transition = 'none';
        state.progressBar.style.width = '100%';
        state.executeBoot(selectedEntry.INIT_PATH);
    }
}

// =================================================================================================
// # UI MANAGEMENT & UPDATES
// =================================================================================================

/**
 * The main function that updates all visual elements when the selection changes.
 */
function updateMenuSelection() {
    highlightSelectedOption();
    updateSelectionIndicator();
    updateInfoPanel();
}

/**
 * Adds/removes the 'selected' class from the menu options.
 */
function highlightSelectedOption() {
    const options = document.querySelectorAll('.boot-option');
    options.forEach((el, index) => {
        el.classList.toggle('selected', index === state.selectedEntryIndex);
    });
}

/**
 * Positions and sizes the visual selection indicator.
 */
function updateSelectionIndicator() {
    const selectedElement = document.querySelector('.boot-option.selected');
    if (selectedElement && state.selectionIndicator) {
        state.selectionIndicator.style.top = `${selectedElement.offsetTop}px`;
        state.selectionIndicator.style.height = `${selectedElement.offsetHeight}px`;
    }
}

/**
 * Updates the info panel with the details of the selected boot entry.
 */
function updateInfoPanel() {
    const entryKeys = Object.keys(state.bootConfig.entries);
    const selectedKey = entryKeys[state.selectedEntryIndex];
    const entryData = state.bootConfig.entries[selectedKey];

    if (entryData && state.infoPanel) {
        state.infoPanel.innerHTML = `
            <h2>${entryData.DESCRIPTION || 'No description'}</h2>
            <p>PATH: <span>${entryData.INIT_PATH || 'N/A'}</span></p>
            <p>MODE: <span>${selectedKey.toUpperCase()}</span></p>
            <p>CHECKSUM: <span>${generateChecksum(entryData.INIT_PATH)}</span></p>
        `;
    }
}

// =================================================================================================
// # INITIAL SETUP FUNCTIONS
// =================================================================================================

/**
 * Determines and sets the initial selection index based on the configuration.
 */
function setupInitialSelection() {
    const entries = state.bootConfig.entries || {};
    const entryKeys = Object.keys(entries);
    const defaultKey = state.bootConfig.DEFAULT || entryKeys[0];

    let initialIndex = entryKeys.indexOf(defaultKey);
    state.selectedEntryIndex = (initialIndex === -1) ? 0 : initialIndex;
}

/**
 * Dynamically builds the boot menu elements from the configuration.
 */
function buildBootMenu() {
    const menuEl = document.getElementById('boot-menu');
    if (!menuEl) return;

    const entries = state.bootConfig.entries || {};
    Object.keys(entries).forEach((key, index) => {
        const entry = entries[key];
        const optionEl = document.createElement('div');
        optionEl.className = 'boot-option';
        optionEl.textContent = entry.DESCRIPTION || key; // Use the key as a fallback

        optionEl.addEventListener('click', () => {
            state.selectedEntryIndex = index;
            updateMenuSelection();
            bootSelectedEntry();
        });

        menuEl.appendChild(optionEl);
    });
}

/**
 * Starts the auto-boot countdown timer and updates the progress bar.
 */
function startCountdown() {
    const timeout = parseInt(state.bootConfig.TIMEOUT, 10);
    let countdown = isNaN(timeout) ? 10 : timeout;
    const totalTime = countdown;

    const updateCountdown = () => {
        if (state.footerText) {
            state.footerText.innerHTML = `Use <span>[↑↓]</span> to Navigate, <span>[Enter]</span> to Boot. Auto boot in ${countdown}s...`;
        }
        if (state.progressBar) {
            const progress = (countdown / totalTime) * 100;
            state.progressBar.style.width = `${progress}%`;
        }

        countdown--;

        if (countdown < 0) {
            bootSelectedEntry();
        }
    };

    updateCountdown(); // Initial call to display immediately
    state.countdownInterval = setInterval(updateCountdown, 1000);
}


// =================================================================================================
// # EVENT HANDLING EXPORTS
// =================================================================================================

/**
 * Exported object to allow the bootloader to call the update and boot functions
 * in response to keyboard events.
 */
export const graphicalKeydownHandler = {
    update: updateMenuSelection,
    boot: bootSelectedEntry
};