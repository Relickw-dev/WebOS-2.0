// File: js/bin/head.js

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
 * Logica principală pentru comanda head, adaptată ca generator.
 */
export function* logic({ args, cwd, stdin }) {
    let lineCount = 10;
    let filePath = null;
    let rawLineCountArg = '10';

    const remainingArgs = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '-n') {
            if (i + 1 < args.length) {
                rawLineCountArg = args[i + 1];
                lineCount = parseInt(rawLineCountArg, 10);
                i++; 
            } else {
                yield { 
                    type: 'stdout', 
                    data: { type: 'error', message: 'head: option requires an -- n argument' } 
                };
                return;
            }
        } else {
            remainingArgs.push(arg);
        }
    }

    if (remainingArgs.length > 0) {
        filePath = remainingArgs[0];
    }
    
    if (isNaN(lineCount) || lineCount < 0) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `head: invalid line count: ‘${rawLineCountArg}’` } 
        };
        return;
    }

    let content = null;
    try {
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            // Înlocuim 'await syscall' cu 'yield'
            content = yield {
                type: 'syscall',
                name: 'vfs.readFile',
                params: { path: fullPath }
            };
        } else {
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: 'head: missing file or input from pipe' } 
            };
            return;
        }

        if (content) {
            const lines = content.split('\n');
            const outputLines = lines.slice(0, lineCount);
            
            // Recomandare: trimitem fiecare linie separat pentru a evita probleme de formatare în terminal
            for(const line of outputLines) {
                 yield { 
                    type: 'stdout', 
                    data: { message: line } 
                };
            }
        }
    } catch (e) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `head: ${filePath}: ${e.message}` } 
        };
    }
}