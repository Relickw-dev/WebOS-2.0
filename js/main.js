// File: js/main.js (Versiune actualizată)
import { kernel } from './kernel/kernel.js';
import { eventBus } from './eventBus.js';
import vfs from './devices/vfs.js';
/**
 * NOU: Funcție pentru a verifica starea serverului backend.
 * Trimite o cerere către un endpoint simplu pentru a vedea dacă serverul răspunde.
 * @returns {Promise<boolean>} - True dacă serverul este online, false altfel.
 */
async function checkServerStatus() {
    try {
        // Folosim endpoint-ul /api/commands, dar ar putea fi orice endpoint valid.
        // Opțiunea 'timeout' nu este standard în fetch, dar gestionăm eroarea de rețea.
        const response = await fetch('http://localhost:3000/api/commands', {
            method: 'GET',
            signal: AbortSignal.timeout(2000) // Adăugăm un timeout de 2 secunde.
        });
        return response.ok;
    } catch (error) {
        // Eșecul (de ex: 'Failed to fetch') indică faptul că serverul nu rulează sau nu poate fi accesat.
        console.error('Server status check failed:', error.message);
        return false;
    }
}


function launchTerminal() {
    console.log('Requesting kernel to launch a new terminal process...');
    eventBus.emit('proc.exec', {
        pipeline: [{
            name: 'terminal-process',
            args: [],
            runOn: 'main'
        }],
        onOutput: () => {},
        onExit: () => {},
        cwd: '/'
    });
}

async function startWebOS() {
    console.log('WebOS: Starting boot sequence...');
    
    const isServerOnline = await checkServerStatus();
    if (!isServerOnline) {
        document.body.innerHTML = `<div style="font-family: monospace; color: red; padding: 20px;">
            FATAL ERROR: Connection to backend server failed.<br>
            Please start the server and refresh the page.
        </div>`;
        return;
    }

    await kernel.init();
    vfs.init();
    // Lansăm primul terminal la pornire
    launchTerminal();

    // ==========================================================
    // AICI ESTE NOUA LOGICĂ PENTRU BUTON
    // ==========================================================
    const openTerminalBtn = document.getElementById('open-terminal-btn');
    if (openTerminalBtn) {
        openTerminalBtn.addEventListener('click', () => {
            // La click, lansăm un alt terminal
            launchTerminal();
        });
    }
    // ==========================================================

    console.log('WebOS: Boot completed. Handed off to kernel.');
}

window.addEventListener('DOMContentLoaded', startWebOS);