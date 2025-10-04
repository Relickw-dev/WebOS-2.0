// File: js/bin/history.js

/**
 * Logica principală pentru comanda history, adaptată ca generator.
 */
export function* logic() {
    try {
        // 1. Apelăm syscall-ul pentru a cere istoricul, folosind 'yield'.
        const commandHistory = yield {
            type: 'syscall',
            name: 'shell.get_history'
        };

        if (commandHistory && commandHistory.length > 0) {
            // 2. Logica de formatare rămâne neschimbată.
            const formattedHistory = commandHistory
                .map((cmd, index) => {
                    const lineNumber = (index + 1).toString().padStart(4, ' ');
                    return `${lineNumber}  ${cmd}`;
                })
                .join('\n');

            // 3. Trimitem istoricul formatat ca un singur output, folosind 'yield'.
            yield { 
                type: 'stdout', 
                data: { message: formattedHistory }
            };
        }
    } catch (e) {
        // Trimitem eroarea prin 'yield'.
        yield { 
            type: 'stdout', 
            data: { type: 'error', message: `history: ${e.message}` } 
        };
    }
}