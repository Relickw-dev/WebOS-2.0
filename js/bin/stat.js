// File: js/bin/stat.js

/**
 * Logica principală pentru comanda stat.
 * Afișează informații detaliate despre unul sau mai multe fișiere/directoare.
 * Adaptată pentru noul sistem de procese și îmbunătățită pentru robustețe.
 */
export function* logic({ args, cwd }) {
    const paths = args.filter(arg => !arg.startsWith('-'));

    if (paths.length === 0) {
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: 'stat: missing operand' } 
        };
        return;
    }

    // Iterează prin fiecare cale furnizată ca argument.
    for (const path of paths) {
        try {
            const absolutePath = path.startsWith('/') 
                ? path 
                : [cwd, path].join('/').replace(/\/+/g, '/');
            
            // Cere metadatele fișierului printr-un syscall.
            const stats = yield {
                type: 'syscall',
                name: 'vfs.stat',
                params: { path: absolutePath }
            };

            // Afișează un separator dacă procesăm mai multe fișiere.
            if (paths.length > 1) {
                yield { type: 'stdout', data: { message: '---' } };
            }

            // Trimitem fiecare linie de output separat pentru o formatare curată.
            yield { type: 'stdout', data: { message: `  File: ${path}` } };
            yield { type: 'stdout', data: { message: `  Size: ${stats.size} Bytes` } };
            yield { type: 'stdout', data: { message: `  Type: ${stats.type}` } };
            
            // Verificăm dacă timestamp-urile există înainte de a le afișa
            if (stats.mtime) {
                yield { type: 'stdout', data: { message: `Modify: ${new Date(stats.mtime).toLocaleString()}` } };
            }
            if (stats.ctime) {
                yield { type: 'stdout', data: { message: `Change: ${new Date(stats.ctime).toLocaleString()}` } };
            }

        } catch (e) {
            // Dacă un fișier nu poate fi accesat, afișează eroarea și continuă cu următorul.
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: e.message || `stat: cannot stat ‘${path}’: No such file or directory` } 
            };
        }
    }
}