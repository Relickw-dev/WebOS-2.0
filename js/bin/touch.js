// File: js/bin/touch.js

/**
 * Logica principală pentru comanda touch.
 * Creează unul sau mai multe fișiere goale folosind sistemul de procese preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'.
export async function* logic({ args, cwd, syscall }) {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        yield { 
            type: 'stdout', 
            data: { message: 'touch: missing file operand', isError: true } 
        };
        return;
    }

    for (const path of paths) {
        try {
            // Logica de construire a căii rămâne aceeași.
            const absolutePath = path.startsWith('/') 
                ? path 
                : `${cwd}/${path}`.replace(/\/+/g, '/');
            
            // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
            // Nu avem nevoie de rezultat, deci nu asignăm rezultatul la o variabilă.
            await syscall('vfs.writeFile', { 
                path: absolutePath, 
                content: '', 
                append: false 
            });

        } catch (e) {
            // Trimitem eroarea prin 'yield'.
            yield { 
                type: 'stdout', 
                data: { message: e.message || `touch: cannot touch ‘${path}’: No such file or directory`, isError: true } 
            };
        }
    }
}