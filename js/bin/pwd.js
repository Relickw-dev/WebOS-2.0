// File: js/bin/pwd.js

/**
 * Logica principală pentru comanda pwd (print working directory).
 * Afișează directorul de lucru curent, adaptată pentru noul sistem de procese.
 */
export function* logic({ cwd }) {
    // Argumentul 'cwd' (current working directory) este furnizat de shell.
    // Îl trimitem la output folosind 'yield'.
    yield {
        type: 'stdout',
        data: { message: cwd }
    };
}