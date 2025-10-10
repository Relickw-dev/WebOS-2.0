// File: js/bootloader.js (Orchestrator cu Fast Boot)
import { parseConfig, checkServerStatus } from './boot/utils.js';
import { initGraphicalUI, graphicalKeydownHandler } from './boot/ui.js';
import { switchToConsoleMode, consoleKeydownHandler } from './boot/console.js';

// Obiectul de stare centralizat
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
    executeBoot: executeBoot,
};

async function executeBoot(path) {
    // Dacă UI-ul există, facem animația de fade-out
    if (state.uiContainer) {
        state.uiContainer.style.transition = 'opacity 0.5s ease-out';
        state.uiContainer.style.opacity = '0';
    }

    const isServerOnline = await checkServerStatus();
    if (!isServerOnline) {
        // Dacă eșecul apare în timpul fast boot, trebuie să creăm UI-ul pentru a afișa eroarea
        if (!state.uiContainer) await createAndSwitchToConsole(new Error("Backend server connection failed."));
        else {
            state.uiContainer.style.opacity = '1';
            const errorTarget = state.footerText || document.querySelector('#boot-output');
            if(errorTarget) errorTarget.innerHTML += '<p style="color: #ff4d4d;">FATAL: Backend server connection failed.</p>';
        }
        return false;
    }

    try {
        const initModule = await import(path);
        if (initModule && typeof initModule.startSystem === 'function') {
            const delay = state.uiContainer ? 500 : 0; // Delay doar dacă avem UI de ascuns
            setTimeout(async () => {
                await initModule.startSystem();
                if (state.uiContainer) state.uiContainer.remove();
            }, delay);
        } else { 
            throw new Error('`startSystem` function not found.'); 
        }
    } catch (error) {
        if (!state.uiContainer) await createAndSwitchToConsole(error);
        else {
            state.uiContainer.style.opacity = '1';
            const errorTarget = state.footerText || document.querySelector('#boot-output');
            if (errorTarget) errorTarget.innerHTML += `<p style="color: #ff4d4d;">FATAL: Could not load init script: ${error.message}</p>`;
        }
        return false;
    }
}

/**
 * NOU: O funcție ajutătoare pentru a crea UI-ul și a intra direct în consolă
 */
async function createAndSwitchToConsole(error) {
    state.uiContainer = document.createElement('div');
    state.uiContainer.id = 'bootloader-ui';
    document.body.appendChild(state.uiContainer);

    state.uiContainer.innerHTML = `
        <div id="boot-panel">
            <header id="boot-header"><h1></h1><span id="boot-timestamp"></span></header>
            <main id="boot-content"></main>
            <footer id="boot-footer">
                <div id="progress-bar-container"><div id="progress-bar"></div></div>
                <div id="boot-footer-text"></div>
            </footer>
        </div>
    `;
    state.progressBar = document.getElementById('progress-bar');
    state.footerText = document.getElementById('boot-footer-text');
    document.getElementById('boot-timestamp').textContent = new Date().toUTCString();
    
    switchToConsoleMode(state, error);
}

async function startBootloader() {
    // Listener-ul este adăugat necondiționat
    window.addEventListener('keydown', (e) => {
        if (state.UIMode === 'graphical') {
            if (!state.bootConfig.entries || Object.keys(state.bootConfig.entries).length === 0) return;
            
            clearInterval(state.countdownInterval);
            state.progressBar.style.transition = 'width 0.2s ease';
            state.progressBar.style.width = '100%';
            state.footerText.innerHTML = 'Use <span>[↑↓]</span> to Navigate, <span>[Enter]</span> to Boot.';
            
            const entryCount = Object.keys(state.bootConfig.entries).length;
            if (e.key === 'ArrowUp') { e.preventDefault(); state.selectedEntryIndex = (state.selectedEntryIndex - 1 + entryCount) % entryCount; graphicalKeydownHandler.update(); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); state.selectedEntryIndex = (state.selectedEntryIndex + 1) % entryCount; graphicalKeydownHandler.update(); }
            else if (e.key === 'Enter') { graphicalKeydownHandler.boot(); }
        } else if (state.UIMode === 'console') {
            consoleKeydownHandler(e.key, e);
        }
    });
    
    try {
        const response = await fetch('/boot.config');
        if (!response.ok) throw new Error(`boot.config not found (HTTP ${response.status})`);
        
        state.bootConfig = parseConfig(await response.text());

        // ==========================================================
        // NOUA LOGICĂ PENTRU FAST BOOT
        // ==========================================================
        if (state.bootConfig.FAST_BOOT === 'true') {
            const defaultKey = state.bootConfig.DEFAULT;
            const defaultEntry = state.bootConfig.entries?.[defaultKey];
            if (defaultEntry && defaultEntry.INIT_PATH) {
                // Încercăm să pornim direct, fără UI
                await executeBoot(defaultEntry.INIT_PATH);
                return; // Oprim execuția dacă boot-ul a pornit
            } else {
                // Fast boot e activ, dar configurația e greșită
                throw new Error('Fast Boot enabled, but default entry is invalid or missing.');
            }
        }
        // ==========================================================
        
        // Dacă ajungem aici, Fast Boot este dezactivat sau a eșuat mai sus
        // și trebuie să construim UI-ul normal.
        state.uiContainer = document.createElement('div');
        state.uiContainer.id = 'bootloader-ui';
        document.body.appendChild(state.uiContainer);

        state.uiContainer.innerHTML = `
            <div id="boot-panel">
                <header id="boot-header"><h1>WebOS Boot Manager</h1><span id="boot-timestamp"></span></header>
                <main id="boot-content"></main>
                <footer id="boot-footer">
                    <div id="progress-bar-container"><div id="progress-bar"></div></div>
                    <div id="boot-footer-text">Initializing...</div>
                </footer>
            </div>
        `;
        state.progressBar = document.getElementById('progress-bar');
        state.footerText = document.getElementById('boot-footer-text');
        document.getElementById('boot-timestamp').textContent = new Date().toUTCString();

        if (state.bootConfig.entries && Object.keys(state.bootConfig.entries).length > 0) {
            document.getElementById('boot-content').innerHTML = `
                <div id="boot-menu"><div id="selection-indicator"><span>[</span><span>]</span></div></div>
                <div id="info-panel"></div>
            `;
            state.selectionIndicator = document.getElementById('selection-indicator');
            state.infoPanel = document.getElementById('info-panel');
            initGraphicalUI(state);
        } else { 
            throw new Error('boot.config is empty or invalid.');
        }
    } catch (error) {
        // Dacă UI-ul nu a fost creat (pt că a eșuat un fast boot), îl creăm acum
        if (!state.uiContainer) {
            await createAndSwitchToConsole(error);
        } else {
            // UI-ul există, deci doar comutăm conținutul
            switchToConsoleMode(state, error);
        }
    }
}

window.addEventListener('DOMContentLoaded', startBootloader);