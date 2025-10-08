// File: js/bin/stat.js

/**
 * Logica principală pentru comanda stat.
 * Afișează informații detaliate despre unul sau mai multe fișiere/directoare.
 * Adaptată pentru noul sistem de procese preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'.
export async function* logic({ args, cwd, syscall }) {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        yield { 
            type: 'stdout', 
            data: { message: 'stat: missing operand', isError: true } 
        };
        return;
    }

    // Iterează prin fiecare cale furnizată ca argument.
    for (const path of paths) {
        try {
            // Logica de rezolvare a căii rămâne neschimbată.
            const absolutePath = path.startsWith('/') 
                ? path 
                : `${cwd}/${path}`.replace(/\/+/g, '/');
            
            // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
            const stats = await syscall('vfs.stat', { path: absolutePath });

            // Afișează un separator dacă procesăm mai multe fișiere.
            if (paths.length > 1 && paths.indexOf(path) > 0) {
                 yield { type: 'stdout', data: { message: '---' } };
            }

            // Trimitem fiecare linie de output separat pentru o formatare curată.
            yield { type: 'stdout', data: { message: `  File: ${path}` } };
            yield { type: 'stdout', data: { message: `  Size: ${stats.size} Bytes` } };
            yield { type: 'stdout', data: { message: `  Type: ${stats.type}` } };
            
            // Verificăm dacă timestamp-urile există înainte de a le afișa.
            if (stats.mtime) {
                yield { type: 'stdout', data: { message: `Modify: ${new Date(stats.mtime).toLocaleString()}` } };
            }
            if (stats.ctime) {
                yield { type: 'stdout', data: { message: `Change: ${new Date(stats.ctime).toLocaleString()}` } };
            }

        } catch (e) {
            // Blocul 'catch' prinde erorile și continuă cu următorul fișier.
            yield { 
                type: 'stdout', 
                data: { message: e.message || `stat: cannot stat ‘${path}’: No such file or directory`, isError: true } 
            };
        }
    }
}