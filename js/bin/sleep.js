// File: js/bin/sleep.js

// Modificare 1: Primim 'syscall' ca parametru.
export const logic = async function*({ args, syscall }) {
    // Preia numărul de secunde din argumente, cu valoarea implicită 1
    const seconds = parseFloat(args[0] || '1');
    
    // Verifică dacă input-ul este valid
    if (isNaN(seconds)) {
        yield { type: 'stdout', data: { message: 'sleep: invalid time interval', isError: true } };
        return;
    }

    try {
        // Modificare 2: Înlocuim 'yield' cu 'await syscall'.
        await syscall('proc.sleep', { ms: seconds * 1000 });
    } catch (e) {
        // Gestionează erorile
        yield { type: 'stdout', data: { message: e.message, isError: true } };
    }
};