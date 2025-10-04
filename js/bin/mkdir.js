// File: js/bin/mkdir.js

/**
 * Logica principală pentru comanda mkdir, adaptată pentru noul sistem de procese.
 */
export function* logic({ args, cwd }) {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        // Înlocuim onOutput cu 'yield' pentru a trimite un mesaj de eroare.
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'mkdir: missing operand' } 
        };
        return; // Oprim execuția generatorului.
    }

    for (const path of paths) {
        try {
            // Logica de construire a căii rămâne aceeași.
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Înlocuim 'await syscall(...)' cu 'yield' pentru a cere un syscall.
            yield {
                type: 'syscall',
                name: 'vfs.mkdir',
                params: { path: absolutePath }
            };

        } catch (e) {
            // Trimitem eroarea prin 'yield'.
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: e.message || `mkdir: cannot create directory ‘${path}’` } 
            };
        }
    }
}