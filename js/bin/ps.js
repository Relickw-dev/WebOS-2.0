// File: js/bin/ps.js
export const logic = async function*() {
    try {
        // Apelează syscall-ul pentru a obține lista de procese
        const processes = yield { type: 'syscall', name: 'proc.list' };
        
        let output = 'PID  STATUS   COMMAND\n';
        // Formatează și afișează fiecare proces
        for (const p of processes) {
            output += `${p.pid.toString().padEnd(4)} ${p.status.padEnd(8)} ${p.name}\n`;
        }
        
        // Trimite output-ul la terminal
        yield { type: 'stdout', data: { message: output } };
    } catch (e) {
        // Gestionează erorile
        yield { type: 'stdout', data: { type: 'error', message: e.message } };
    }
};