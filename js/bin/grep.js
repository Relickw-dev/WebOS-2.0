// File: js/bin/grep.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda grep.
 * Caută un text într-un fișier și afișează liniile care îl conțin.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    if (args.length < 2) {
        onOutput({ type: 'error', message: 'Usage: grep <pattern> <file>' });
        return;
    }

    const pattern = args[0];
    const path = args[1];

    try {
        const absolutePath = path.startsWith('/') 
            ? path 
            : [cwd, path].join('/').replace(/\/+/g, '/');
        
        // Apelăm noul syscall pentru a obține liniile care se potrivesc
        const matchingLines = await syscall('vfs.grep', { path: absolutePath, pattern });

        if (matchingLines.length > 0) {
            // Formatăm și afișăm fiecare linie, evidențiind textul găsit
            matchingLines.forEach(line => {
                const highlightedLine = line.replace(
                    new RegExp(pattern, 'g'), 
                    `<span class="grep-highlight">${pattern}</span>`
                );
                onOutput({ message: highlightedLine });
            });
        }

    } catch (e) {
        onOutput({ type: 'error', message: e.message });
    }
};