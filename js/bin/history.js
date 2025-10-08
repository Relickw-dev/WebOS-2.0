// File: js/bin/history.js

/**
 * Logica principală pentru comanda history, adaptată pentru noul sistem preemptiv.
 */
export async function* logic({ syscall }) {
    try {
        // Acest apel este corect. El emite un eveniment pe care shell.js îl va asculta.
        const commandHistory = await syscall('shell.get_history');

        if (commandHistory && commandHistory.length > 0) {
            const formattedHistory = commandHistory
                .map((cmd, index) => {
                    const lineNumber = (index + 1).toString().padStart(4, ' ');
                    return `${lineNumber}  ${cmd}`;
                })
                .join('\n');

            yield { 
                type: 'stdout', 
                data: { message: formattedHistory }
            };
        }
    } catch (e) {
        yield { 
            type: 'stdout', 
            data: { message: `history: ${e.message}`, isError: true } 
        };
    }
}