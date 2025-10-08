// File: js/bin/head.js

import { resolvePath } from '../utils/path.js';
/**
 * Logica principală pentru comanda head, adaptată pentru noul sistem preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'.
export async function* logic({ args, cwd, stdin, syscall }) {
    let lineCount = 10;
    let filePath = null;
    let rawLineCountArg = '10';

    // Logica de parsare a argumentelor rămâne neschimbată.
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
                    data: { message: 'head: option requires an -- n argument', isError: true } 
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
            data: { message: `head: invalid line count: ‘${rawLineCountArg}’`, isError: true } 
        };
        return;
    }

    let content = null;
    try {
        // Logica de citire din stdin sau fișier rămâne aceeași.
        if (stdin !== null && stdin !== undefined) {
            content = stdin;
        } else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
            content = await syscall('vfs.readFile', { path: fullPath });
        } else {
            yield { 
                type: 'stdout', 
                data: { message: 'head: missing file or input from pipe', isError: true } 
            };
            return;
        }

        if (content) {
            // Logica de procesare și afișare a liniilor rămâne neschimbată.
            const lines = content.split('\n');
            const outputLines = lines.slice(0, lineCount);
            
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
            data: { message: `head: ${filePath}: ${e.message}`, isError: true } 
        };
    }
}