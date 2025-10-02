// File: js/bin/head.js
import { syscall } from '../kernel/syscalls.js';

// Funcție ajutătoare pentru a rezolva căile relative (`.` și `..`).
function resolvePath(basePath, newPath) {
    if (newPath.startsWith('/')) {
        return newPath;
    }
    const baseParts = basePath.split('/').filter(p => p.length > 0);
    const newParts = newPath.split('/');
    for (const part of newParts) {
        if (part === '..') {
            baseParts.pop();
        } else if (part !== '.' && part !== '') {
            baseParts.push(part);
        }
    }
    return '/' + baseParts.join('/');
}

export const logic = async ({ args, onOutput, cwd, stdin }) => {
    let lineCount = 10;
    let filePath = null;
    let rawLineCountArg = '10';

    // Parsare simplă a argumentelor pentru a găsi numărul de linii și calea fișierului.
    const remainingArgs = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-n') {
            if (i + 1 < args.length) {
                rawLineCountArg = args[i + 1];
                lineCount = parseInt(rawLineCountArg, 10);
                i++; // Am consumat următorul argument, deci îl sărim.
            } else {
                onOutput({ type: 'error', message: 'head: option requires an -- n argument' });
                return 1;
            }
        } else {
            // Orice nu este o opțiune este considerat o cale de fișier.
            remainingArgs.push(arg);
        }
    }

    if (remainingArgs.length > 0) {
        filePath = remainingArgs[0];
    }
    
    // Validăm dacă numărul de linii este un număr valid.
    if (isNaN(lineCount) || lineCount < 0) {
        onOutput({ type: 'error', message: `head: invalid line count: ‘${rawLineCountArg}’` });
        return 1;
    }

    let content = null;
    try {
        // Logica de citire: prioritate are `stdin`, apoi fișierul.
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            // Dacă nu avem nici `stdin`, nici cale de fișier, afișăm eroare.
            onOutput({ type: 'error', message: 'head: missing file or input from pipe' });
            return 1;
        }

        // Procesarea și afișarea rezultatului.
        if (content) {
            const lines = content.split('\n');
            const outputLines = lines.slice(0, lineCount);
            onOutput({ message: outputLines.join('\n') });
        }

        return 0; // Succes
    } catch (e) {
        onOutput({ type: 'error', message: `head: ${filePath}: ${e.message}` });
        return 1; // Eroare
    }
};