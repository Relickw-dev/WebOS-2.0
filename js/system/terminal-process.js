// File: js/system/terminal-process.js (Versiune finală, actualizată cu clase)

// Pas 1: Importăm Clasele, nu obiectele singleton
import { Terminal } from '../devices/terminal.js';
import { Shell } from '../shell/shell.js';
import { eventBus } from '../eventBus.js';

const terminalHTML = `
    <div class="glow-container">
        <main id="container-{pid}" class="container" tabindex="0" style="position: absolute; top: calc(50% - 40vh + {v_offset}px); left: calc(50% - 35vw + {h_offset}px);">
            <div class="terminal-header">
                <div class="title">
                    <span class="title-icon"></span>
                    SOLUS :: TERMINAL (PID: {pid})
                </div>
                <div class="buttons">
                    <span class="btn minimize"></span>
                    <span class="btn maximize"></span>
                    <span class="btn close"></span>
                </div>
            </div>

            <div id="terminal">
                <div id="terminal-output"></div>
                <div id="current-line" class="prompt-line">
                    <span id="prompt"></span>
                    <input type="text" id="terminal-input" autocomplete="off" spellcheck="false" />
                    <span class="caret"></span>
                </div>
            </div>
        </main>
    </div>
`;

export const process = {
    start: async ({ pid }) => {
        console.log(`Starting terminal process with PID: ${pid}`);

        const desktop = document.getElementById('desktop');
        if (!desktop) {
            console.error("Fatal: #desktop container not found in DOM.");
            return;
        }

        const processContainer = document.createElement('div');
        processContainer.id = `process-${pid}`;

        // Pas 2: Calculăm un decalaj pentru fiecare fereastră nouă
        const v_offset = (pid - 1) * 25;
        const h_offset = (pid - 1) * 25;

        // Înlocuim toți placeholder-ii, inclusiv noile decalaje
        processContainer.innerHTML = terminalHTML
            .replace(/{pid}/g, pid)
            .replace('{v_offset}', v_offset)
            .replace('{h_offset}', h_offset);

        desktop.appendChild(processContainer);

        // Logica pentru a asculta semnalul de 'kill' rămâne
        const handleTermination = ({ pid: pidToKill }) => {
            if (pidToKill === pid) {
                console.log(`Terminal process ${pid} received kill signal. Removing window.`);
                processContainer.remove();
                eventBus.off('proc.terminate_main', handleTermination);
            }
        };
        eventBus.on('proc.terminate_main', handleTermination);
        
        // Pas 3: Creăm instanțe noi pentru fiecare terminal
        // Selectorul este acum corect, căutând ID-ul unic
        const terminalRoot = processContainer.querySelector(`#container-${pid}`);
        
        // Creăm o nouă instanță de Terminal
        const terminalInstance = new Terminal(pid, terminalRoot);
        
        // Creăm o nouă instanță de Shell și o legăm de terminalul curent
        const shellInstance = new Shell(terminalInstance);
        
        // Conectăm cele două instanțe
        terminalInstance.connectShell(shellInstance);

        console.log(`Terminal process ${pid} started and UI is ready.`);
    }
};