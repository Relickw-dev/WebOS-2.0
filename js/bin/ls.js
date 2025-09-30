// File: js/bin/ls.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Listează conținutul unui director în mod recursiv.
 * @param {string} path Calea directorului de listat.
 * @param {number} depth Nivelul de adâncime pentru indentare.
 * @param {function} onOutput Funcția de callback pentru a trimite ieșirea către terminal.
 */
async function listDirectoryRecursive(path, depth, onOutput) {
    const prefix = '  '.repeat(depth);
    try {
        const entries = await syscall('vfs.readDir', { path });
        
        for (const entry of entries) {
            const entryPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
            onOutput({ message: `${prefix}- ${entry.name} (${entry.type})` });

            // Corecția: se verifică 'dir' în loc de 'directory'
            if (entry.type === 'dir') {
                // Apel recursiv pentru subdirectoare
                await listDirectoryRecursive(entryPath, depth + 1, onOutput);
            }
        }
    } catch (e) {
        onOutput({ type: 'error', message: `ls: cannot access '${path}': No such file or directory` });
    }
}

/**
 * Funcția principală de logică pentru comanda ls.
 * @param {object} params Parametrii de execuție, inclusiv args, onOutput și cwd.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    const pathArgs = args.filter(arg => !arg.startsWith('-'));
    const path = pathArgs.length > 0 ? pathArgs[0] : cwd;
    const recursive = args.includes('-r');
    
    if (recursive) {
        onOutput({ message: `Listing directory tree for: ${path}` });
        await listDirectoryRecursive(path, 0, onOutput);
    } else {
        try {
            const entries = await syscall('vfs.readDir', { path });
            onOutput({ message: `Contents of ${path}:` });
            entries.forEach(entry => {
                onOutput({ message: `- ${entry.name} (${entry.type})` });
            });
        } catch (e) {
            onOutput({ type: 'error', message: `ls: cannot access '${path}': No such file or directory` });
        }
    }
};