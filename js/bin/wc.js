// File: js/bin/wc.js
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
    let showLines = false;
    let showWords = false;
    let showChars = false;
    let filePath = null;

    // 1. Parsarea argumentelor pentru a identifica flag-urile și fișierul.
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
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            onOutput({ type: 'error', message: 'wc: usage: wc [-lwc] [file]' });
            return 1;
        }

        // 3. Logica de numărare.
        const lineCount = (content.match(/\n/g) || []).length;
        const wordCount = content.trim() === '' ? 0 : (content.trim().split(/\s+/).filter(w => w.length > 0)).length;
        const charCount = content.length;

        // --- MODIFICARE CHEIE ---
        // 4. Formatarea output-ului cu etichete descriptive.
        let outputParts = [];
        if (showLines) outputParts.push(`Lines: ${lineCount}`);
        if (showWords) outputParts.push(`Words: ${wordCount}`);
        if (showChars) outputParts.push(`Characters: ${charCount}`);

        // Unim părțile cu câteva spații pentru lizibilitate.
        let message = outputParts.join('   ');

        if (filePath) {
            message += `   (${filePath})`;
        }
        
        onOutput({ message });
        // --- SFÂRȘIT MODIFICARE ---

        return 0; // Succes
    } catch (e) {
        onOutput({ type: 'error', message: `wc: ${filePath || ''}: ${e.message}` });
        return 1; // Eroare
    }
};