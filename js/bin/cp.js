// File: js/bin/cp.js

/**
 * Logica principală pentru comanda cp.
 * Copiază un fișier sau un director (cu -r) către o destinație.
 * Adaptată pentru sistemul de procese preemtiv.
 */
export function* logic({ args, cwd }) {
    // Detectăm flag-ul de recursivitate
    const isRecursive = args.includes('-r') || args.includes('-rf');

    // Căile sunt toate argumentele care nu încep cu '-'
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length < 2) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'cp: missing destination file operand' } 
        };
        return;
    }

    if (paths.length > 2) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `cp: target '${paths[paths.length - 1]}' is not a directory` } 
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
            name: 'vfs.copyFile',
            params: { 
                source: sourcePath, 
                destination: destinationPath,
                recursive: isRecursive 
            }
        };

    } catch (e) {
        // Înlocuim onOutput cu 'yield'
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: e.message || `cp: cannot copy` } 
        };
    }
}