// File: js/bin/echo.js
import { syscall } from '../kernel/syscalls.js';

/**
 * Logica principală pentru comanda echo.
 * Afișează argumentele primite direct în terminal.
 * @param {object} params Parametrii de execuție, inclusiv args și onOutput.
 */
export const logic = async ({ args, onOutput }) => {
    // Îmbină toate argumentele într-un singur șir
    const message = args.join(' ');
    
    // Trimite mesajul către terminal folosind apelul de sistem
    onOutput({ message });
};