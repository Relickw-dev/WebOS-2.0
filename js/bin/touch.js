// File: js/bin/touch.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda touch.
 * Creează unul sau mai multe fișiere goale.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        onOutput({ type: 'error', message: 'touch: missing file operand' });
        return;
    }

    for (const path of paths) {
        try {
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            const syscallArgs = { path: absolutePath, content: '', append: false };

            // --- ADAUGĂ ACEST BLOC PENTRU DEPANARE ---
            console.log('Calling syscall vfs.writeFile with:', syscallArgs);
            // Verifică în consolă dacă 'content' este prezent aici ca string gol.

            await syscall('vfs.writeFile', syscallArgs);

        } catch (e) {
            onOutput({ type: 'error', message: e.message || `touch: cannot touch ‘${path}’: No such file or directory` });
        }
    }
};