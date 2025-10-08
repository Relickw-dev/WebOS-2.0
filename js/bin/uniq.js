// File: js/bin/uniq.js

import { resolvePath } from '../utils/path.js';

/**
 * Logica principală pentru comanda uniq.
 * Elimină liniile duplicate adiacente dintr-un fișier sau din stdin.
 */
export async function* logic({ args, cwd, stdin, syscall }) {
    try {
        let content;
        // Căutăm un nume de fișier printre argumente.
        const filePath = args.find(arg => !arg.startsWith('-'));

        // Prioritizăm intrarea prin pipe (stdin).
        if (typeof stdin === 'string') {
            content = stdin;
        } 
        // Dacă nu avem stdin, dar avem o cale de fișier, citim fișierul.
        else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            content = await syscall('vfs.readFile', { path: fullPath });
        } 
        // Dacă nu avem niciuna, nu avem ce procesa.
        else {
            return; // Ieșim silențios.
        }

        content = content || '';
        const lines = content.split('\n');

        // Vom folosi această variabilă pentru a memora ultima linie afișată.
        let lastLine = null;

        for (const line of lines) {
            // Comparația `line !== lastLine` este esența comenzii 'uniq'.
            // Afișăm linia curentă doar dacă este diferită de cea anterioară.
            if (line !== lastLine) {
                yield {
                    type: 'stdout',
                    data: { message: line }
                };
                // Actualizăm ultima linie afișată.
                lastLine = line;
            }
        }

    } catch (e) {
        yield {
            type: 'stdout',
            data: { message: `uniq: ${e.message}`, isError: true }
        };
    }
}