// File: js/system/terminal-process.js (Refactorizat)

import { Window } from '../ui/window.js'; // Pas 1: Importăm noua clasă Window
import { Terminal } from '../devices/terminal.js';
import { Shell } from '../shell/shell.js';
import { eventBus } from '../eventBus.js';

// Pas 2: HTML-ul specific terminalului este acum mult mai simplu
const terminalContentHTML = `
    <div id="terminal">
        <div id="terminal-output"></div>
        <div id="current-line" class="prompt-line">
            <span id="prompt"></span>
            <input type="text" id="terminal-input" autocomplete="off" spellcheck="false" />
            <span class="caret"></span>
        </div>
    </div>
`;

export const process = {
    start: async ({ pid }) => {
        console.log(`Starting terminal process with PID: ${pid}`);

        // Pas 3: Creăm o instanță de fereastră generică
        const appWindow = new Window(pid, {
            title: 'SOLUS :: TERMINAL'
        });

        // Pas 4: Obținem containerul pentru conținut și injectăm HTML-ul terminalului
        const contentArea = appWindow.getContentElement();
        contentArea.innerHTML = terminalContentHTML;

        const handleTermination = ({ pid: pidToKill }) => {
            if (pidToKill === pid) {
                console.log(`Terminal process ${pid} received kill signal. Closing window.`);
                appWindow.close(); // Folosim metoda close a ferestrei
                eventBus.off('proc.terminate_main', handleTermination);
            }
        };
        eventBus.on('proc.terminate_main', handleTermination);
        
        // Logica de creare a terminalului și shell-ului rămâne aceeași,
        // dar folosește `contentArea` ca rădăcină.
        const terminalRoot = contentArea.querySelector('#terminal');
        
        const terminalInstance = new Terminal(pid, terminalRoot);
        const shellInstance = new Shell(terminalInstance);
        
        terminalInstance.connectShell(shellInstance);

        console.log(`Terminal process ${pid} started and UI is ready.`);
    }
};