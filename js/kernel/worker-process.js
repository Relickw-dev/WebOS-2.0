// File: js/kernel/worker-process.js

let callIdCounter = 0;
const syscallPromises = new Map();

// 1. Funcția 'syscall' din interiorul worker-ului
function syscall(name, params) {
    return new Promise((resolve, reject) => {
        const callId = callIdCounter++;
        syscallPromises.set(callId, { resolve, reject });
        postMessage({
            type: 'syscall',
            payload: { name, params, callId }
        });
    });
}

// 2. Gestionarea mesajelor de la kernel (firul principal)
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
        // Când primim rezultatul unui syscall
        case 'syscall_result': {
            const { result, callId } = payload;
            if (syscallPromises.has(callId)) {
                syscallPromises.get(callId).resolve(result);
                syscallPromises.delete(callId);
            }
            break;
        }

        // Când primim o eroare de la un syscall
        case 'syscall_error': {
            const { error, callId } = payload;
            if (syscallPromises.has(callId)) {
                syscallPromises.get(callId).reject(new Error(error));
                syscallPromises.delete(callId);
            }
            break;
        }

        // Când worker-ul este inițializat de kernel
        case 'init': {
            const { procInfo, cwd, stdin } = payload; // --- MODIFICARE CHEIE AICI ---
            try {
                // Importăm dinamic codul comenzii (ex: /js/bin/grep.js)
                const module = await import(`/js/bin/${procInfo.name}.js`);
                if (!module.logic || typeof module.logic !== 'function') {
                    throw new Error(`Command '${procInfo.name}' does not have a valid 'logic' function.`);
                }

                // Creăm un obiect cu toți parametrii necesari pentru funcția 'logic'
                const logicParams = {
                    args: procInfo.args,
                    cwd,
                    stdin, // --- MODIFICARE CHEIE AICI: Includem stdin-ul primit ---
                    syscall // Pasăm funcția noastră 'syscall'
                };

                // Executăm funcția generator 'logic'
                for await (const result of module.logic(logicParams)) {
                    if (result.type === 'stdout') {
                        postMessage({ type: 'stdout', payload: { data: result.data } });
                    }
                }

                // Dacă generatorul se termină fără erori, trimitem codul de ieșire 0 (succes).
                postMessage({ type: 'exit', payload: { exitCode: 0 } });

            } catch (error) {
                // Trimitem eroarea la kernel pentru a fi afișată în terminal
                postMessage({ type: 'error', payload: { message: error.message } });
                // Și încheiem procesul cu un cod de eroare.
                postMessage({ type: 'exit', payload: { exitCode: 1 } });
            }
            break;
        }
    }
};