// File: js/bin/ls.js

/**
 * Listează conținutul unui director în mod recursiv, ca o funcție generator.
 * @param {string} path Calea directorului de listat.
 * @param {number} depth Nivelul de adâncime pentru indentare.
 */
function* listDirectoryRecursive(path, depth) {
    const prefix = '  '.repeat(depth);
    try {
        // Cere un syscall pentru a citi directorul.
        const entries = yield {
            type: 'syscall',
            name: 'vfs.readDir',
            params: { path }
        };
        
        for (const entry of entries) {
            const entryPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
            
            // Trimite output-ul pentru intrarea curentă.
            yield { 
                type: 'stdout', 
                data: { message: `${prefix}- ${entry.name} (${entry.type})` }
            };

            if (entry.type === 'dir') {
                // Deleagă execuția către apelul recursiv folosind yield*.
                yield* listDirectoryRecursive(entryPath, depth + 1);
            }
        }
    } catch (e) {
        // Trimite eroarea.
        yield {
            type: 'stdout',
            data: { type: 'error', message: `ls: cannot access '${path}': No such file or directory` }
        };
    }
}

/**
 * Funcția principală de logică pentru comanda ls, adaptată ca generator.
 */
export function* logic({ args, cwd }) {
    const pathArgs = args.filter(arg => !arg.startsWith('-'));
    const path = pathArgs.length > 0 ? pathArgs[0] : cwd;
    const recursive = args.includes('-r');
    
    if (recursive) {
        yield { 
            type: 'stdout', 
            data: { message: `Listing directory tree for: ${path}` } 
        };
        // Deleagă întreaga listare recursivă către funcția ajutătoare.
        yield* listDirectoryRecursive(path, 0);
    } else {
        try {
            // Cere un syscall pentru a citi directorul.
            const entries = yield {
                type: 'syscall',
                name: 'vfs.readDir',
                params: { path }
            };

            yield { 
                type: 'stdout', 
                data: { message: `Contents of ${path}:` } 
            };

            for (const entry of entries) {
                yield { 
                    type: 'stdout', 
                    data: { message: `- ${entry.name} (${entry.type})` } 
                };
            }
        } catch (e) {
            yield { 
                type: 'stdout', 
                data: { type: 'error', message: `ls: cannot access '${path}': No such file or directory` } 
            };
        }
    }
}