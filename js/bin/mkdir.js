// File: js/bin/mkdir.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda mkdir.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        onOutput({ type: 'error', message: 'mkdir: missing operand' });
        return;
    }

    for (const path of paths) {
        try {
            // Rezolvă calea relativă, asigurându-te că nu există slash-uri duplicate
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            await syscall('vfs.mkdir', { path: absolutePath });
        } catch (e) {
            onOutput({ type: 'error', message: e.message || `mkdir: cannot create directory ‘${path}’` });
        }
    }
};