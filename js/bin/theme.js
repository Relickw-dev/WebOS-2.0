// File: js/bin/theme.js

/**
 * Logica pentru comanda 'theme'.
 * Schimbă tema vizuală a aplicației între 'light' și 'dark'.
 */
export function* logic({ args }) {
    const selectedTheme = args[0];

    if (selectedTheme === 'light' || selectedTheme === 'dark') {
        // Emitem un syscall pentru a cere schimbarea temei.
        // Comanda nu manipulează direct DOM-ul.
        yield {
            type: 'syscall',
            name: 'terminal.set_theme',
            params: { theme: selectedTheme }
        };
        yield {
            type: 'stdout',
            data: { message: `Theme changed to ${selectedTheme}.` }
        };
    } else {
        // Afișăm un mesaj de ajutor dacă argumentul este invalid.
        yield {
            type: 'stdout',
            data: { type: 'error', message: 'Usage: theme [light|dark]' }
        };
    }
}