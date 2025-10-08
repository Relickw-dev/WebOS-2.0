// File: js/bin/cat.js (Versiune CORECTATĂ și simplificată)

export async function* logic({ args, cwd, stdin, syscall }) {
    // Cazul 1: Se primește input prin pipe (stdin) și nu sunt alte argumente
    if (stdin && args.length === 0) {
        // Trimitem direct conținutul stdin la output
        yield { type: 'stdout', data: { message: stdin } };
        return;
    }

    // Cazul 2: Nu există nici fișiere, nici stdin
    if (args.length === 0) {
        yield { 
            type: 'stdout', 
            data: { message: 'cat: missing file operand', isError: true } 
        };
        return;
    }

    // Cazul 3: Se citesc unul sau mai multe fișiere
    for (const relativePath of args) { 
        try { 
            // Rezolvăm calea pentru a fi absolută. Logica ta era corectă.
            const path = relativePath.startsWith('/') 
                ? relativePath 
                : `${cwd === '/' ? '' : cwd}/${relativePath}`;

            const content = await syscall('vfs.readFile', { path });
            
            // Trimitem tot conținutul fișierului dintr-o singură bucată.
            // Terminalul va afișa corect liniile multiple.
            yield { type: 'stdout', data: { message: content } };
            
        } catch (e) { 
            yield { 
                type: 'stdout', 
                data: { message: `cat: ${relativePath}: ${e.message}`, isError: true } 
            }; 
        } 
    } 
}