// File: js/bin/kill.js

// Modificare 1: Primim 'syscall' ca parametru.
export const logic = async function*({ args, syscall }) {
    // Verificarea argumentelor rămâne neschimbată.
    if (!args || args.length === 0) {
        yield { type: 'stdout', data: { message: 'Usage: kill [pid]', isError: true } };
        return;
    }

    const pid = parseInt(args[0], 10);
    if (isNaN(pid)) {
        yield { type: 'stdout', data: { message: `kill: invalid pid: ${args[0]}`, isError: true } };
        return;
    }

    try {
        // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
        await syscall('proc.kill', { pid });
        
        yield { type: 'stdout', data: { message: `Process ${pid} has been terminated.` } };
    } catch (e) {
        // Blocul 'catch' va prinde erorile de la 'await'.
        yield { type: 'stdout', data: { message: e.message, isError: true } };
    }
};