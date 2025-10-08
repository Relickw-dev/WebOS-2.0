// File: js/bin/mkdir.js

/**
 * Logica principală pentru comanda mkdir, adaptată pentru noul sistem de procese preemptiv.
 */
export async function* logic({ args, cwd, syscall }) {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        // Trimitem un mesaj de eroare prin 'yield'.
        yield { 
            type: 'stdout', 
            data: { message: 'mkdir: missing operand', isError: true } 
        };
        return; // Oprim execuția.
    }

    for (const path of paths) {
        try {
            // Logica de construire a căii rămâne aceeași.
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Apelăm direct syscall-ul folosind 'await'.
            await syscall('vfs.mkdir', { path: absolutePath });

        } catch (e) {
            // Trimitem eroarea prin 'yield'.
            yield { 
                type: 'stdout', 
                data: { message: e.message || `mkdir: cannot create directory ‘${path}’`, isError: true } 
            };
        }
    }
}