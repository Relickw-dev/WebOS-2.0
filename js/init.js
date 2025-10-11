// File: js/init.js (Optimized and updated with English Logger)
// The main entry point for the WebOS operating system,
// responsible for setting up the environment and launching essential services.

// =================================================================================================
// # IMPORTS
// =================================================================================================

import { kernel } from './kernel/kernel.js';
import { eventBus } from './eventBus.js';
import vfs from './devices/vfs.js';
import { logger } from './utils/logger.js';

// =================================================================================================
// # CONSTANTS
// =================================================================================================

/**
 * The basic HTML structure for the operating system's desktop environment.
 * @type {string}
 */
const DESKTOP_CONTAINER_HTML = '<div id="desktop"></div>';

// =================================================================================================
// # MAIN INITIALIZATION FUNCTION (Public API)
// =================================================================================================

/**
 * Initializes the operating system. This is the function called by the bootloader
 * after initial checks have been successfully completed.
 *
 * The order of operations is crucial:
 * 1. Prepare the graphical interface (the desktop).
 * 2. Initialize core services (kernel, VFS).
 * 3. Launch initial processes (e.g., the terminal).
 */
export async function startSystem() {
    logger.info('WebOS Init: Initialization process started.');

    // Step 1: Prepare the graphical interface
    setupDesktopEnvironment();

    // Step 2: Initialize system services
    try {
        await kernel.init();
        vfs.init();
        logger.info('WebOS Init: Kernel and VFS have been initialized.');
    } catch (error) {
        logger.error('WebOS Init: Critical error during system services initialization.', error);
        // In a real system, a "kernel panic" or a visual error message would be displayed here.
        document.body.innerHTML = '<p style="color: red;">Critical error on system startup. Please reboot.</p>';
        return;
    }

    // Step 3: Launch initial processes
    launchInitialProcesses();
    
    logger.info('WebOS Init: Boot process completed. Control handed over to the kernel.');
}

// =================================================================================================
// # HELPER FUNCTIONS
// =================================================================================================

/**
 * Cleans the `document.body` of previous content (e.g., the bootloader)
 * and injects the main desktop container.
 */
function setupDesktopEnvironment() {
    logger.info('WebOS Init: Setting up desktop environment...');
    // `innerHTML` is an efficient way to completely replace the content.
    document.body.innerHTML = DESKTOP_CONTAINER_HTML;
}

/**
 * Launches the essential processes for system startup, such as the initial shell.
 */
function launchInitialProcesses() {
    logger.info('WebOS Init: Launching initial processes...');
    launchTerminal();
}

/**
 * Sends a request to the kernel, via the eventBus, to launch a new terminal process.
 */
function launchTerminal() {
    logger.info('WebOS Init: Requesting kernel to launch a new terminal process.');

    // Configuration object for the process to be executed.
    const processConfig = {
        pipeline: [{
            name: 'terminal-process', // Name of the executable/process
            args: [],                  // Command-line arguments
            runOn: 'main'              // Execution context (main thread)
        }],
        onOutput: () => {}, // Handler for stdout/stderr (not necessary for the initial process)
        onExit: () => {},   // Handler for process termination
        cwd: '/'            // Current working directory
    };

    eventBus.emit('proc.exec', processConfig);
}