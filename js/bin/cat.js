// File: js/bin/cat.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda cat.
 * Afișează conținutul unuia sau mai multor fișiere.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        onOutput({ type: 'error', message: 'cat: missing file operand' });
        return;
    }

    for (const path of paths) {
        try {
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            const content = await syscall('vfs.readFile', { path: absolutePath });
            
            // --- CORECȚIA ESTE AICI ---
            // 1. Împărțim conținutul fișierului într-un array de linii.
            //    Folosim o expresie regulată pentru a gestiona atât \n (Linux/macOS) cât și \r\n (Windows).
            const lines = content.split(/\r?\n/);
            
            // 2. Iterăm prin fiecare linie și o trimitem individual către terminal.
            //    Acest lucru asigură că fiecare linie este afișată corect.
            for (const line of lines) {
                onOutput({ message: line });
            }

        } catch (e) {
            onOutput({ type: 'error', message: e.message || `cat: ‘${path}’: No such file or directory` });
        }
    }
};