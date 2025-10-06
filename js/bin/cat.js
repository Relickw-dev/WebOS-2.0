// File: js/bin/cat.js

export function* logic({ args, cwd, stdin }) {
    // Funcție internă pentru a procesa și trimite un bloc de text linie cu linie
    function* processAndYield(content) {
        if (typeof content !== 'string') return;
        
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (i === lines.length - 1 && line === '') {
                continue;
            }

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
            const content = yield {
                type: 'syscall',
                name: 'vfs.readFile',
                params: { path, cwd }
            };
            yield* processAndYield(content);
        } catch (e) {
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: `cat: ${path}: ${e.message}` } 
            };
        }
    }
}