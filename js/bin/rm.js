// File: js/bin/rm.js

/**
 * Logica principală pentru comanda rm.
 * Șterge fișiere sau directoare (dacă este specificat -r).
 * Adaptată pentru noul sistem de procese.
 */
export function* logic({ args, cwd }) {
    // Verificăm dacă există flag-ul pentru ștergere recursivă
    const isRecursive = args.includes('-r') || args.includes('-rf');

    // Căile sunt toate argumentele care nu încep cu '-'
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'rm: missing operand' } 
        };
        return;
    }

    for (const path of paths) {
        try {
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Înlocuim 'await syscall(...)' cu 'yield' pentru a cere un syscall
            yield {
                type: 'syscall',
                name: 'vfs.rm',
                params: { path: absolutePath, recursive: isRecursive }
            };

        } catch (e) {
            // Trimitem eroarea prin 'yield'
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: e.message || `rm: cannot remove ‘${path}’` } 
            };
        }
    }
}