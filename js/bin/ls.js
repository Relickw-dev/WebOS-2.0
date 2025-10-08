// File: js/bin/ls.js

/**
 * Listează conținutul unui director în mod recursiv, ca o funcție async generator.
 * @param {string} path Calea directorului de listat.
 * @param {number} depth Nivelul de adâncime pentru indentare.
 * @param {function} syscall Funcția pentru a face apeluri de sistem.
 */
async function* listDirectoryRecursive(path, depth, syscall) {
    const prefix = '  '.repeat(depth);
    try {
        // Apelăm direct syscall-ul folosind await.
        const entries = await syscall('vfs.readDir', { path });
        
        for (const entry of entries) {
            const entryPath = path === '/' ? `/${entry.name}` : `${path}/${entry.name}`;
            
            // Trimite output-ul pentru intrarea curentă.
            yield { 
                type: 'stdout', 
                data: { message: `${prefix}- ${entry.name} (${entry.type})` }
            };

            if (entry.type === 'dir') {
                // Deleagă execuția către apelul recursiv folosind yield*.
                yield* listDirectoryRecursive(entryPath, depth + 1, syscall);
            }
        }
    } catch (e) {
        // Trimite eroarea.
        yield {
            type: 'stdout',
            data: { message: `ls: cannot access '${path}': No such file or directory`, isError: true }
        };
    }
}

/**
 * Funcția principală de logică pentru comanda ls, adaptată ca async generator.
 */
export async function* logic({ args, cwd, syscall }) {
    const pathArgs = args.filter(arg => !arg.startsWith('-'));
    const path = pathArgs.length > 0 ? pathArgs[0] : cwd;
    const recursive = args.includes('-r');
    
    if (recursive) {
        yield { 
            type: 'stdout', 
            data: { message: ` Listing directory tree for: ${path}` } 
        };
        // Deleagă întreaga listare recursivă către funcția ajutătoare.
        yield* listDirectoryRecursive(path, 0, syscall);
    } else {
        try {
            // Apelăm direct syscall-ul folosind await.
            const entries = await syscall('vfs.readDir', { path });

            yield { 
                type: 'stdout', 
                data: { message: ` Contents of ${path}:` } 
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
                data: { message: `ls: cannot access '${path}': No such file or directory`, isError: true } 
            };
        }
    }
}