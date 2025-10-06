// File: js/bin/cat.js

// Modificare 1: Funcția devine un generator asincron (async function*)
export async function* logic({ args, cwd, stdin, syscall }) {

    // Funcția internă rămâne un generator sincron, deoarece nu face operații asincrone
    function* processAndYield(content) {
        if (typeof content !== 'string') return;
        
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Nu afișăm ultima linie goală dacă fișierul se termină cu newline
            if (i === lines.length - 1 && line === '') {
                continue;
            }

            // Yield pentru stdout rămâne la fel
            yield {
                type: 'stdout',
                data: { type: 'string', message: line }
            };
        }
    }

    // Cazul 1: Se primește input prin pipe (stdin)
    if (stdin && args.length === 0) {
        yield* processAndYield(stdin);
        return;
    }

    // Cazul 2: Nu există nici fișiere, nici stdin
    if (args.length === 0) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'cat: missing file operand' } 
        };
        return;
    }

    // Cazul 3: Se citesc unul sau mai multe fișiere
    for (const path of args) {
        try {
            // Modificare 2: Apelul de sistem se face cu 'await syscall'
            const content = await syscall('vfs.readFile', { path, cwd });
            yield* processAndYield(content);
        } catch (e) {
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: `cat: ${path}: ${e.message}` } 
            };
        }
    }
}