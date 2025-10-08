// File: js/bin/wc.js

import { resolvePath } from '../utils/path.js';

/**
 * Logica principală pentru comanda wc, adaptată pentru noul sistem preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'.
export async function* logic({ args, cwd, stdin, syscall }) {
    let showLines = false;
    let showWords = false;
    let showChars = false;
    let filePath = null;

    // 1. Parsarea argumentelor (logica neschimbată).
    const fileArgs = [];
    for (const arg of args) {
        if (arg.startsWith('-')) {
            if (arg.includes('l')) showLines = true;
            if (arg.includes('w')) showWords = true;
            if (arg.includes('c')) showChars = true;
        } else {
            fileArgs.push(arg);
        }
    }

    if (fileArgs.length > 0) {
        filePath = fileArgs[0];
    }

    if (!showLines && !showWords && !showChars) {
        showLines = true;
        showWords = true;
        showChars = true;
    }

    let content = null;
    try {
        // 2. Citirea conținutului (din stdin sau fișier).
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            // Dacă nu avem nici stdin, nici fișier, afișăm eroarea de utilizare.
            // Acest caz este gestionat corect, nu necesită syscall.
            yield { 
                type: 'stdout', 
                data: { message: 'wc: usage: wc [-lwc] [file]', isError: true } 
            };
            return;
        }

        // Asigurăm că avem un string cu care să lucrăm.
        content = content || '';

        // 3. Logica de numărare (neschimbată).
        const lineCount = (content.match(/\n/g) || []).length;
        const wordCount = content.trim() === '' ? 0 : (content.trim().split(/\s+/).filter(w => w.length > 0)).length;
        const charCount = content.length;

        // 4. Formatarea output-ului (logica neschimbată).
        let outputParts = [];
        if (showLines) outputParts.push(`Lines: ${lineCount}`);
        if (showWords) outputParts.push(`Words: ${wordCount}`);
        if (showChars) outputParts.push(`Characters: ${charCount}`);

        let message = outputParts.join('   ');

        if (filePath) {
            message += `   (${filePath})`;
        }
        
        // Trimitem rezultatul final folosind 'yield'.
        yield { 
            type: 'stdout', 
            data: { message } 
        };

    } catch (e) {
        yield { 
            type: 'stdout', 
            data: { message: `wc: ${filePath || ''}: ${e.message}`, isError: true } 
        };
    }
}