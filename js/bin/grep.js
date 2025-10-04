// File: js/bin/grep.js

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
 * Logica principală pentru comanda grep, adaptată ca generator.
 */
export function* logic({ args, cwd, stdin }) {
    if (args.length < 1) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'grep: Missing pattern' } 
        };
        return;
    }

    const pattern = args[0];
    let regex;
    try {
        regex = new RegExp(pattern, 'gi'); 
    } catch (e) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `grep: Invalid pattern: ${e.message}` } 
        };
        return;
    }
    
    let content = null;

    try {
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (args.length > 1) {
            const filePath = args[1];
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
                data: { type: 'error', message: 'grep: Missing file or piped input' } 
            };
            return;
        }

        if (content) {
            const lines = content.split('\n');
            for (const line of lines) {
                // Resetăm indexul regex-ului pentru fiecare linie
                regex.lastIndex = 0; 
                if (line && regex.test(line)) {
                    // Resetăm din nou pentru a asigura că 'replace' funcționează corect
                    regex.lastIndex = 0; 
                    const highlightedLine = line.replace(regex, (match) => `<span class="grep-highlight">${match}</span>`);
                    
                    // Înlocuim 'onOutput' cu 'yield'
                    yield { 
                        type: 'stdout', 
                        data: { message: highlightedLine, isHtml: true } 
                    };
                }
            }
        }

    } catch (e) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `grep: ${e.message}` } 
        };
    }
}