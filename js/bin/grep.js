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
 * Logica principală pentru comanda grep, adaptată ca async generator.
 */
export async function* logic({ args, cwd, stdin, syscall }) {
    if (args.length < 1) {
        yield { 
            type: 'stdout', 
            data: { message: 'grep: Missing pattern', isError: true } 
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
            data: { message: `grep: Invalid pattern: ${e.message}`, isError: true } 
        };
        return;
    }
    
    let content = null;

    try {
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (args.length > 1) {
            const filePath = args[1];
            // Am pasat și syscall aici pentru consistență, deși nu este folosit în funcție
            const fullPath = resolvePath(cwd, filePath);
            
            // Apelăm direct syscall-ul folosind 'await'.
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            yield { 
                type: 'stdout', 
                data: { message: 'grep: Missing file or piped input', isError: true } 
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
                    
                    // Trimitem output-ul prin 'yield'.
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
            data: { message: `grep: ${e.message}`, isError: true } 
        };
    }
}