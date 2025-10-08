// File: js/bin/rm.js

/**
 * Logica principală pentru comanda rm.
 * Șterge fișiere sau directoare (dacă este specificat -r).
 * Adaptată pentru noul sistem de procese preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'.
export async function* logic({ args, cwd, syscall }) {
    // Verificăm dacă există flag-ul pentru ștergere recursivă.
    const isRecursive = args.includes('-r') || args.includes('-rf');

    // Căile sunt toate argumentele care nu încep cu '-'.
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        yield { 
            type: 'stdout', 
            data: { message: 'rm: missing operand', isError: true } 
        };
        return;
    }

    // Iterăm prin fiecare cale furnizată.
    for (const path of paths) {
        try {
            // Logica de rezolvare a căii este corectă și o păstrăm.
            const absolutePath = path.startsWith('/') 
                ? path 
                : `${cwd}/${path}`.replace(/\/+/g, '/');
            
            // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
            await syscall('vfs.rm', { 
                path: absolutePath, 
                recursive: isRecursive 
            });

        } catch (e) {
            // Blocul 'catch' va prinde erorile pentru fiecare fișier în parte.
            yield { 
                type: 'stdout', 
                data: { message: e.message || `rm: cannot remove ‘${path}’`, isError: true } 
            };
        }
    }
}