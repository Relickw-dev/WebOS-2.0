// File: js/bin/pwd.js

/**
 * Logica principală pentru comanda pwd (print working directory).
 * Afișează directorul de lucru curent.
 */
export const logic = async ({ onOutput, cwd }) => {
    // Argumentul 'cwd' (current working directory) este deja furnizat de shell
    // la executarea oricărei comenzi. Trebuie doar să îl afișăm.
    onOutput({ message: cwd });
};