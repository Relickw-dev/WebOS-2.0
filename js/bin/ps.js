// File: js/bin/ps.js

// Modificare 1: Primim 'syscall' ca parametru.
export const logic = async function*({ syscall }) {
    try {
        // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
        const processes = await syscall('proc.list');
        
        // Logica de formatare a output-ului rămâne neschimbată.
        let output = ' PID  STATUS   COMMAND\n';
        if (processes && processes.length > 0) {
            for (const p of processes) {
                // Asigurăm că p.pid și p.status există înainte de a le folosi
                const pid = p.pid?.toString() || '??';
                const status = p.status || 'UNKNOWN';
                const name = p.name || '[unknown]';
                output += `${pid.padEnd(4)} ${status.padEnd(8)} ${name}\n`;
            }
        }
        
        // Trimite output-ul la terminal
        yield { type: 'stdout', data: { message: output } };

    } catch (e) {
        // Gestionează erorile
        yield { type: 'stdout', data: { message: e.message, isError: true } };
    }
};