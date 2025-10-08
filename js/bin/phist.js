// File: js/bin/process-history.js

export const logic = async function*({ syscall }) {
    try {
        // 1. Apelăm noul syscall pentru a obține istoricul complet al proceselor.
        const history = await syscall('proc.history');

        // 2. Formatăm datele într-un tabel lizibil.
        let output = ' PID  STATUS      COMMAND         STARTED_AT      ENDED_AT        EXIT\n';
        output += ' ---- ----------- --------------- --------------- --------------- ----\n';

        if (history && history.length > 0) {
            for (const p of history) {
                const pid = p.pid.toString().padEnd(4);
                const status = p.status.padEnd(11);
                const name = p.name.padEnd(15);
                const startTime = p.startTime.toLocaleTimeString().padEnd(15);
                const endTime = (p.endTime ? p.endTime.toLocaleTimeString() : 'N/A').padEnd(15);
                const exitCode = (p.exitCode !== null ? p.exitCode.toString() : 'N/A');
                
                output += `${pid} ${status} ${name} ${startTime} ${endTime} ${exitCode}\n`;
            }
        } else {
            output += 'No process history found.\n';
        }

        // 3. Trimitem tabelul formatat către terminal.
        yield { type: 'stdout', data: { message: output } };

    } catch (e) {
        yield { type: 'stdout', data: { message: e.message, isError: true } };
    }
};