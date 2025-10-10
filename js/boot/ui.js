// File: js/boot/ui.js
import { generateChecksum } from './utils.js';

let state = {};

function updateMenuSelection() {
    const options = document.querySelectorAll('.boot-option');
    options.forEach((el, index) => el.classList.toggle('selected', index === state.selectedEntryIndex));

    const selectedElement = options[state.selectedEntryIndex];
    if (selectedElement) {
        state.selectionIndicator.style.top = `${selectedElement.offsetTop}px`;
        state.selectionIndicator.style.height = `${selectedElement.offsetHeight}px`;
    }
    
    const entryKey = Object.keys(state.bootConfig.entries)[state.selectedEntryIndex];
    const entryData = state.bootConfig.entries[entryKey];
    if (entryData) {
        state.infoPanel.innerHTML = `
            <h2>${entryData.DESCRIPTION || 'No description'}</h2>
            <p>PATH: <span>${entryData.INIT_PATH || 'N/A'}</span></p>
            <p>MODE: <span>${entryKey.toUpperCase()}</span></p>
            <p>CHECKSUM: <span>${generateChecksum(entryData.INIT_PATH)}</span></p>
        `;
    }
}

function bootSelectedEntry() {
    clearInterval(state.countdownInterval);
    const entryKey = Object.keys(state.bootConfig.entries)[state.selectedEntryIndex];
    const selectedEntry = state.bootConfig.entries[entryKey];
    
    if (selectedEntry && selectedEntry.INIT_PATH) {
        state.footerText.textContent = `Booting '${selectedEntry.DESCRIPTION}'...`;
        state.progressBar.style.transition = 'none';
        state.progressBar.style.width = '100%';
        state.executeBoot(selectedEntry.INIT_PATH);
    }
}

export function initGraphicalUI(initialState) {
    state = initialState;

    const defaultKey = state.bootConfig.DEFAULT || Object.keys(state.bootConfig.entries)[0];
    state.selectedEntryIndex = Object.keys(state.bootConfig.entries).indexOf(defaultKey);
    if (state.selectedEntryIndex === -1) state.selectedEntryIndex = 0;

    const menuEl = document.getElementById('boot-menu');
    const entryKeys = Object.keys(state.bootConfig.entries);

    entryKeys.forEach((key, index) => {
        const entry = state.bootConfig.entries[key];
        const optionEl = document.createElement('div');
        optionEl.className = 'boot-option';
        optionEl.textContent = entry.DESCRIPTION;
        optionEl.addEventListener('click', () => {
            state.selectedEntryIndex = index;
            updateMenuSelection();
            bootSelectedEntry();
        });
        menuEl.appendChild(optionEl);
    });
    
    requestAnimationFrame(() => updateMenuSelection());

    let countdown = parseInt(state.bootConfig.TIMEOUT, 10) || 10;
    const totalTime = countdown;
    const updateCountdown = () => {
        state.footerText.innerHTML = `Use <span>[↑↓]</span> to Navigate, <span>[Enter]</span> to Boot. Auto boot in ${countdown}s...`;
        const progress = (countdown / totalTime) * 100;
        state.progressBar.style.width = `${progress}%`;
        countdown--;
        if (countdown < 0) bootSelectedEntry();
    };
    
    updateCountdown();
    state.countdownInterval = setInterval(updateCountdown, 1000);
}

// Exportăm și funcțiile pe care evenimentul de 'keydown' le va apela
export const graphicalKeydownHandler = {
    update: updateMenuSelection,
    boot: bootSelectedEntry
};