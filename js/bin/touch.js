// File: js/bin/touch.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda touch.
 * Creează unul sau mai multe fișiere goale.
 */
export const logic = async ({ args, onOutput, cwd }) => {
    // Filtrează argumentele pentru a obține doar căile fișierelor
    const paths = args.filter(arg => !arg.startsWith('-'));

    // Verifică dacă a fost furnizat cel puțin un nume de fișier
    if (paths.length === 0) {
        onOutput({ type: 'error', message: 'touch: missing file operand' });
        return;
    }

    // Iterează prin fiecare cale și încearcă să creeze fișierul
    for (const path of paths) {
        try {
            // Rezolvă calea: dacă nu începe cu '/', o considerăm relativă la directorul curent (cwd)
            // .replace(/\/+/g, '/') asigură că nu există slash-uri duplicate (ex: /home//user -> /home/user)
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Apelează sistemul pentru a scrie un fișier.
            // Pentru 'touch', conținutul este un string gol.
            // 'append' este false, deci dacă fișierul există, va fi suprascris (comportamentul standard pentru touch).
            // Dacă nu există, va fi creat.
            await syscall('vfs.writeFile', { path: absolutePath, content: '', append: false });

        } catch (e) {
            // În caz de eroare (ex: cale invalidă, permisiuni), afișează un mesaj de eroare.
            onOutput({ type: 'error', message: e.message || `touch: cannot touch ‘${path}’: No such file or directory` });
        }
    }
};