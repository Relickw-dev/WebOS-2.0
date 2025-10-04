// File: js/bin/touch.js

/**
 * Logica principală pentru comanda touch.
 * Creează unul sau mai multe fișiere goale folosind sistemul de procese preemtiv.
 */
export function* logic({ args, cwd }) {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        // Înlocuim onOutput cu 'yield' pentru a trimite un mesaj de eroare.
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'touch: missing file operand' } 
        };
        return; // Oprim execuția generatorului.
    }

    for (const path of paths) {
        try {
            // Logica de construire a căii rămâne aceeași.
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Înlocuim 'await syscall(...)' cu 'yield' pentru a cere un syscall.
            // Nu avem nevoie de rezultat, deci nu asignăm rezultatul lui yield la o variabilă.
            yield {
                type: 'syscall',
                name: 'vfs.writeFile',
                params: { path: absolutePath, content: '', append: false }
            };

        } catch (e) {
            // Trimitem eroarea prin 'yield'.
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: e.message || `touch: cannot touch ‘${path}’: No such file or directory` } 
            };
        }
    }
}