// File: js/bin/mv.js

/**
 * Logica principală pentru comanda mv.
 * Mută sau redenumește un fișier sau un director.
 * Adaptată pentru noul sistem de procese preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'
export async function* logic({ args, cwd, syscall }) {
    // Flag-ul -r este acceptat pentru compatibilitate, dar ignorat.
    const paths = args.filter(arg => !arg.startsWith('-'));

    // Validarea numărului de argumente rămâne neschimbată.
    if (paths.length < 2) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'mv: missing destination file operand' } 
        };
        return;
    }
    
    if (paths.length > 2) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `mv: target '${paths[paths.length - 1]}' is not a directory` } 
        };
        return;
    }

    const [source, destination] = paths;

    try {
        // Logica de rezolvare a căilor este deja corectă și o păstrăm.
        const sourcePath = source.startsWith('/') 
            ? source 
            : `${cwd}/${source}`.replace(/\/+/g, '/');
            
        const destinationPath = destination.startsWith('/')
            ? destination
            : `${cwd}/${destination}`.replace(/\/+/g, '/');

        // Modificare 2: Înlocuim 'yield' cu 'await syscall'
        await syscall('vfs.move', { 
            source: sourcePath, 
            destination: destinationPath 
        });

    } catch (e) {
        // Blocul 'catch' va prinde acum erorile de la 'await'
        yield { 
            type: 'stdout', 
            data: { message: e.message || `mv: cannot move file or directory`, isError: true } 
        };
    }
}