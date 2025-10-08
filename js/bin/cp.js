// File: js/bin/cp.js

/**
 * Logica principală pentru comanda cp.
 * Copiază un fișier sau un director (cu -r) către o destinație.
 * Adaptată pentru sistemul de procese preemptiv și noul model de syscall.
 */
// Modificare 1: Transformăm funcția într-un generator asincron.
export async function* logic({ args, cwd, syscall }) {
    // Detectăm flag-ul de recursivitate
    const isRecursive = args.includes('-r') || args.includes('-rf');

    // Căile sunt toate argumentele care nu încep cu '-'
    const paths = args.filter(arg => !arg.startsWith('-'));

    // Validarea argumentelor rămâne neschimbată
    if (paths.length < 2) {
        yield { 
            type: 'stdout', 
            data: { message: 'cp: missing destination file operand', isError: true } 
        };
        return;
    }

    if (paths.length > 2 && !isRecursive) {
        // Această verificare este relevantă mai ales când destinația nu este un director
        yield { 
            type: 'stdout', 
            data: { message: `cp: target '${paths[paths.length - 1]}' is not a directory`, isError: true } 
        };
        return;
    }

    const [source, destination] = paths;

    try {
        // --- LOGICA PENTRU CWD (DEJA CORECTĂ) ---
        // Construim căile absolute pentru sursă și destinație.
        const sourcePath = source.startsWith('/') 
            ? source 
            : `${cwd}/${source}`.replace(/\/+/g, '/');
            
        const destinationPath = destination.startsWith('/')
            ? destination
            : `${cwd}/${destination}`.replace(/\/+/g, '/');

        // Modificare 2: Folosim 'await syscall' pentru a apela sistemul de fișiere.
        // Orice eroare aruncată de syscall va fi prinsă de blocul 'catch'.
        await syscall('vfs.copyFile', { 
            source: sourcePath, 
            destination: destinationPath,
            recursive: isRecursive 
        });

    } catch (e) {
        // Gestionăm erorile primite de la syscall.
        yield { 
            type: 'stdout', 
            data: { message: e.message || `cp: cannot copy '${source}'`, isError: true } 
        };
    }
}