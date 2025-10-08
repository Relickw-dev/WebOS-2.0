// File: js/bin/sort.js

import { resolvePath } from '../utils/path.js';

/**
 * Logica principală pentru comanda sort, adaptată pentru noul sistem preemptiv.
 * Sortează liniile dintr-un fișier sau din stdin.
 */
export async function* logic({ args, cwd, stdin, syscall }) {
    try {
        let content;
        // Primul argument care nu este un flag este considerat calea fișierului.
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
        // Dacă nu avem niciuna, nu avem ce sorta.
        else {
            return; // Ieșim silențios.
        }

        // Ne asigurăm că avem un string pentru a evita erori.
        content = content || '';

        // Împărțim în linii și sortăm alfabetic.
        const lines = content.split('\n');
        
        // Dacă ultima linie este goală (din cauza unui newline la final), o ignorăm în sortare.
        if (lines[lines.length - 1] === '') {
            lines.pop();
        }
        
        lines.sort();

        // Trimitem fiecare linie sortată la output.
        for (const line of lines) {
            yield {
                type: 'stdout',
                data: { message: line }
            };
        }

    } catch (e) {
        yield {
            type: 'stdout',
            data: { message: `sort: ${e.message}`, isError: true }
        };
    }
}