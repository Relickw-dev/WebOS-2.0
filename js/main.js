// File: js/main.js
import { kernel } from './kernel/kernel.js';
import { shell } from './shell/shell.js';
import { terminal } from './devices/terminal.js';

// --- MODIFICARE AICI ---
// Importăm 'vfs' și îl redenumim 'vfsDriver' folosind 'as'
import vfsDriver from './devices/vfs.js';

async function startWebOS() {
    console.log('WebOS: Starting boot sequence...');

    // Inițializare drivere
    terminal.init();
    vfsDriver.init();

    // Inițializare kernel
    await kernel.init();

    // Inițializare shell
    await shell.init();

    console.log('WebOS: Boot completed.');
}

window.addEventListener('DOMContentLoaded', startWebOS);