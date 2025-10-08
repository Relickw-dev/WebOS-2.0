// File: js/bin/theme.js

/**
 * Logica pentru comanda 'theme'.
 * Schimbă tema vizuală a aplicației.
 * Adaptată pentru noul sistem preemptiv.
 */
// Modificare 1: Transformăm funcția într-un generator asincron și primim 'syscall'.
export async function* logic({ args, syscall }) {
    const selectedTheme = args[0];
    const validThemes = ['light', 'true-dark', 'nord', 'dracula', 'solarized-light', 'neon-blade', 'matrix-green'];

    if (validThemes.includes(selectedTheme)) {
        try {
            // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
            await syscall('terminal.set_theme', { theme: selectedTheme });
            
            yield {
                type: 'stdout',
                data: { message: `Theme changed to ${selectedTheme}.` }
            };
        } catch (e) {
            yield {
                type: 'stdout',
                data: { message: e.message || 'Failed to set theme.', isError: true }
            };
        }
    } else {
        // Afișăm un mesaj de ajutor dacă argumentul este invalid.
        const usage = `Usage: theme [${validThemes.join('|')}]`;
        yield {
            type: 'stdout',
            data: { message: usage, isError: true }
        };
    }
}