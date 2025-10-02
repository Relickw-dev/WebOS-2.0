// File: js/bin/cp.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda cp.
 * Copiază un fișier sau un director (cu -r) către o destinație.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    // Detectăm flag-ul de recursivitate
    const isRecursive = args.includes('-r') || args.includes('-rf');

    // Căile sunt toate argumentele care nu încep cu '-'
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length < 2) {
        onOutput({ type: 'error', message: 'cp: missing destination file operand' });
        return;
    }

    // Momentan, gestionăm doar 'cp sursa destinatie'. Nu 'cp sursa1 sursa2... director'
    if (paths.length > 2) {
        onOutput({ type: 'error', message: `cp: target '${paths[paths.length - 1]}' is not a directory` });
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

        // Trimitem flag-ul 'isRecursive' prin apelul de sistem
        await syscall('vfs.copyFile', { 
            source: sourcePath, 
            destination: destinationPath,
            recursive: isRecursive 
        });

    } catch (e) {
        onOutput({ type: 'error', message: e.message || `cp: cannot copy` });
    }
};