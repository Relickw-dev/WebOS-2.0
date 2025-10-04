// File: js/bin/sleep.js
export const logic = async function*({ args }) {
    // Preia numărul de secunde din argumente, cu valoarea implicită 1
    const seconds = parseFloat(args[0] || '1');
    
    // Verifică dacă input-ul este valid
    if (isNaN(seconds)) {
        yield { type: 'stdout', data: { type: 'error', message: 'sleep: invalid time interval' } };
        return;
    }

    try {
        // Apelează syscall-ul pentru a pune procesul "în adormire"
        yield { type: 'syscall', name: 'proc.sleep', params: { ms: seconds * 1000 } };
    } catch (e) {
        // Gestionează erorile
        yield { type: 'stdout', data: { type: 'error', message: e.message } };
    }
};