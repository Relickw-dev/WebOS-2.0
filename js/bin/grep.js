// File: js/bin/grep.js
import { syscall } from '../kernel/syscalls.js';

// Funcție ajutătoare pentru a rezolva căile.
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
    if (args.length < 1) {
        onOutput({ type: 'error', message: 'grep: Missing pattern' });
        return 1;
    }

    const pattern = args[0];
    let regex;
    try {
        // Am adăugat flag-ul 'g' (global) pentru a înlocui toate aparițiile pe o linie, nu doar prima.
        regex = new RegExp(pattern, 'gi'); 
    } catch (e) {
        onOutput({ type: 'error', message: `grep: Invalid pattern: ${e.message}` });
        return 1;
    }
    
    let content = null;

    try {
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (args.length > 1) {
            const filePath = args[1];
            const fullPath = resolvePath(cwd, filePath);
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            onOutput({ type: 'error', message: 'grep: Missing file or piped input' });
            return 1;
        }

        if (content) {
            const lines = content.split('\n');
            lines.forEach(line => {
                if (line && regex.test(line)) {
                    // --- MODIFICARE CHEIE ---
                    // Înlocuim textul care se potrivește cu același text, dar încapsulat
                    // într-un span cu clasa 'grep-highlight'.
                    const highlightedLine = line.replace(regex, (match) => `<span class="grep-highlight">${match}</span>`);
                    
                    // Trimitem linia formatată ca HTML către terminal.
                    onOutput({ message: highlightedLine, isHtml: true });
                }
            });
        }

        return 0; // Succes
    } catch (e) {
        onOutput({ type: 'error', message: `grep: ${e.message}` });
        return 1; // Eroare
    }
};