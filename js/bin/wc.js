// File: js/bin/wc.js

// Funcția ajutătoare pentru a rezolva căile rămâne neschimbată.
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

/**
 * Logica principală pentru comanda wc, adaptată ca generator.
 */
export function* logic({ args, cwd, stdin }) {
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
            // Înlocuim 'await syscall' cu 'yield'.
            content = yield {
                type: 'syscall',
                name: 'vfs.readFile',
                params: { path: fullPath }
            };
        } else {
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: 'wc: usage: wc [-lwc] [file]' } 
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
            data: { type: 'error', message: `wc: ${filePath || ''}: ${e.message}` } 
        };
    }
}