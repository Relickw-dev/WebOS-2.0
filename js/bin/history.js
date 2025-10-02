// File: js/bin/history.js
import { syscall } from '../kernel/syscalls.js';

export const logic = async ({ onOutput }) => {
    try {
        // 1. Apelăm un nou syscall pentru a cere shell-ului lista de comenzi.
        const commandHistory = await syscall('shell.get_history');

        if (commandHistory && commandHistory.length > 0) {
            // 2. Formatăm fiecare comandă cu numărul liniei.
            const formattedHistory = commandHistory
                .map((cmd, index) => {
                    const lineNumber = (index + 1).toString().padStart(4, ' ');
                    return `${lineNumber}  ${cmd}`;
                })
                .join('\n');

            // 3. Trimitem tot istoricul formatat ca un singur output.
            // Acest lucru îl face compatibil cu pipe-ul către `grep`.
            onOutput({ message: formattedHistory });
        }
        return 0; // Succes
    } catch (e) {
        onOutput({ type: 'error', message: `history: ${e.message}` });
        return 1; // Eroare
    }
};