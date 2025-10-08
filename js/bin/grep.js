// File: js/bin/grep.js
import { resolvePath } from '../utils/path.js';

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
    const filePath = args.length > 1 ? args[1] : null;
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
    
    try {
        let content;

        // --- MODIFICARE CHEIE AICI ---
        // Verificăm explicit dacă am primit ceva prin stdin. Chiar și un string gol este valid.
        if (typeof stdin === 'string') {
            content = stdin;
        } 
        // Dacă nu avem stdin, dar avem un nume de fișier, îl citim.
        else if (filePath) {
            const fullPath = resolvePath(cwd, filePath);
            content = await syscall('vfs.readFile', { path: fullPath });
        } 
        // Dacă nu avem nici stdin, nici fișier, atunci afișăm eroarea.
        else {
            yield { 
                type: 'stdout', 
                data: { message: 'grep: Missing file or piped input', isError: true } 
            };
            return;
        }

        // Procesăm conținutul. `content` poate fi un string gol, ceea ce e corect.
        const lines = content.split('\n');
        for (const line of lines) {
            regex.lastIndex = 0; 
            if (regex.test(line)) {
                regex.lastIndex = 0; 
                const highlightedLine = line.replace(regex, (match) => `<span class="grep-highlight">${match}</span>`);
                
                yield { 
                    type: 'stdout', 
                    data: { message: highlightedLine, isHtml: true } 
                };
            }
        }

    } catch (e) {
        yield { 
            type: 'stdout', 
            data: { message: `grep: ${e.message}`, isError: true } 
        };
    }
}