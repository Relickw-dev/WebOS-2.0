// File: js/main.js
import { kernel } from './kernel/kernel.js';
import { shell } from './shell/shell.js';
import terminalDriver from './devices/terminal.js';
import vfsDriver from './devices/vfs.js';

async function startWebOS() {
    console.log('WebOS: Starting boot sequence...');

    // Inițializare drivere
    terminalDriver.init();
    vfsDriver.init();

    // Inițializare kernel
    await kernel.init();

    // Inițializare shell
    shell.init();

    console.log('WebOS: Boot completed.');
}

window.addEventListener('DOMContentLoaded', startWebOS);