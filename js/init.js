// File: js/init.js (Versiune actualizată)
// Responsabil cu inițializarea serviciilor WebOS după ce bootloader-ul a terminat.

import { kernel } from './kernel/kernel.js';
import { eventBus } from './eventBus.js';
import vfs from './devices/vfs.js';

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

/**
 * Funcția principală de inițializare a sistemului, exportată pentru bootloader.
 */
export async function startSystem() {
    console.log('WebOS: init.js execution started. Initializing OS services...');
    
    // ==========================================================
    // AICI ESTE NOUA LOGICĂ
    // ==========================================================
    // 1. Definim HTML-ul pentru desktop
    const desktopHTML = `
        <div id="desktop">

        </div>
    `;

    // 2. Curățăm body-ul de orice ar fi (deși bootloader-ul se va auto-șterge)
    // și injectăm noul HTML.
    document.body.innerHTML = desktopHTML;
    // ==========================================================

    // Inițializăm kernel-ul și VFS-ul
    await kernel.init();
    vfs.init();
    launchTerminal();
    
    // Lansăm primul terminal la pornire
    console.log('WebOS: Boot completed. Handed off to kernel.');
}