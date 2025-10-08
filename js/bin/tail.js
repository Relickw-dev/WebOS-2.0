// File: js/bin/tail.js

import { resolvePath } from '../utils/path.js';

/**
 * Logica principală pentru comanda tail, adaptată pentru noul sistem preemptiv.
 */
export async function* logic({ args, cwd, stdin, syscall }) {
    let lineCount = 10;
    let filePath = null;
    let rawLineCountArg = '10';

    // Logica de parsare a argumentelor este identică cu cea din 'head'.
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
                    data: { message: 'tail: option requires an -- n argument', isError: true } 
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
            data: { message: `tail: invalid line count: ‘${rawLineCountArg}’`, isError: true } 
        };
        return;
    }

    let content = null;
    try {
        // Logica de citire din stdin sau fișier este identică cu cea din 'head'.
        if (typeof stdin === 'string') {
            content = stdin;
        } else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            yield { 
                type: 'stdout', 
                data: { message: 'tail: missing file or input from pipe', isError: true } 
            };
            return;
        }

        if (content) {
            const lines = content.split('\n');
            
            // --- MODIFICAREA CHEIE AICI ---
            // Folosim .slice(-lineCount) pentru a lua ultimele N linii.
            const outputLines = lines.slice(-lineCount);
            
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
            data: { message: `tail: ${filePath}: ${e.message}`, isError: true } 
        };
    }
}