// File: js/bin/mv.js

/**
 * Logica principală pentru comanda mv.
 * Mută sau redenumește un fișier sau un director.
 * Adaptată pentru noul sistem de procese.
 */
export function* logic({ args, cwd }) {
    // Flag-ul -r este acceptat pentru compatibilitate, dar ignorat.
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length < 2) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'mv: missing destination file operand' } 
        };
        return;
    }
    
    if (paths.length > 2) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `mv: target '${paths[paths.length - 1]}' is not a directory` } 
        };
        return;
    }

    const [source, destination] = paths;

    try {
        const sourcePath = source.startsWith('/') 
            ? source 
            : [cwd, source].join('/').replace(/\/+/g, '/');
            
        const destinationPath = destination.startsWith('/')
            ? destination
            : [cwd, destination].join('/').replace(/\/+/g, '/');

        // Înlocuim 'await syscall(...)' cu 'yield' pentru a cere un syscall
        yield {
            type: 'syscall',
            name: 'vfs.move',
            params: { source: sourcePath, destination: destinationPath }
        };
    } catch (e) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: e.message || `mv: cannot move file or directory` } 
        };
    }
}