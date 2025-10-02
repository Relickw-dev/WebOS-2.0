// File: js/bin/rm.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda rm.
 * Șterge fișiere sau directoare (dacă este specificat -r).
 */
export const logic = async ({ args, onOutput, cwd }) => {
    // Verificăm dacă există flag-ul pentru ștergere recursivă
    const isRecursive = args.includes('-r') || args.includes('-rf');

    // Căile sunt toate argumentele care nu încep cu '-'
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        onOutput({ type: 'error', message: 'rm: missing operand' });
        return;
    }

    for (const path of paths) {
        try {
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Apelăm noul syscall 'vfs.rm' cu parametrul 'recursive'
            await syscall('vfs.rm', { path: absolutePath, recursive: isRecursive });

        } catch (e) {
            onOutput({ type: 'error', message: e.message || `rm: cannot remove ‘${path}’` });
        }
    }
};