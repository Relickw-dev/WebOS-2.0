// File: js/bin/stat.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda stat.
 * Afișează informații detaliate despre un fișier sau director.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        onOutput({ type: 'error', message: 'stat: missing operand' });
        return;
    }

    const path = paths[0];

    try {
        const absolutePath = path.startsWith('/') 
            ? path 
            : [cwd, path].join('/').replace(/\/+/g, '/');
        
        // Apelăm syscall-ul existent pentru a obține metadatele
        const stats = await syscall('vfs.stat', { path: absolutePath });

        // Formatăm răspunsul JSON într-un format lizibil pentru terminal
        const output = `  File: ${path}
  Size: ${stats.size} Bytes
  Type: ${stats.type}
 Modify: ${new Date(stats.mtime).toLocaleString()}
 Change: ${new Date(stats.ctime).toLocaleString()}`;
        
        onOutput({ message: output });

    } catch (e) {
        onOutput({ type: 'error', message: e.message || `stat: cannot stat ‘${path}’: No such file or directory` });
    }
};