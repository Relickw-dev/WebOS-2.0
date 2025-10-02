// File: js/bin/mv.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda mv.
 * Mută sau redenumește un fișier sau un director.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    // Flag-ul -r este acceptat pentru compatibilitate, dar ignorat,
    // deoarece operațiunea de redenumire este recursivă prin natura ei.
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length < 2) {
        onOutput({ type: 'error', message: 'mv: missing destination file operand' });
        return;
    }
    
    if (paths.length > 2) {
        onOutput({ type: 'error', message: `mv: target '${paths[paths.length - 1]}' is not a directory` });
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

        await syscall('vfs.move', { source: sourcePath, destination: destinationPath });
    } catch (e) {
        onOutput({ type: 'error', message: e.message || `mv: cannot move file or directory` });
    }
};