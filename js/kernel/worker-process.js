// File: js/kernel/worker-process.js

let procInfo, cwd, pid;
let syscallId = 0;
const pendingSyscalls = new Map();

// Funcția 'syscall' pentru contextul worker-ului
function syscall(name, params = {}) {
    return new Promise((resolve, reject) => {
        const callId = syscallId++;
        pendingSyscalls.set(callId, { resolve, reject });
        // Trimite cererea de syscall către kernel (main thread)
        self.postMessage({ type: 'syscall', payload: { name, params, callId } });
    });
}

// Handler pentru mesajele primite de la kernel
self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        // Inițializăm procesul la primirea datelor de la kernel
        procInfo = payload.procInfo;
        cwd = payload.cwd;
        pid = payload.pid;
        await run();
    } else if (type === 'syscall_result') {
        // Am primit rezultatul unui syscall
        const { result, callId } = payload;
        if (pendingSyscalls.has(callId)) {
            pendingSyscalls.get(callId).resolve(result);
            pendingSyscalls.delete(callId);
        }
    } else if (type === 'syscall_error') {
        // Am primit o eroare de la un syscall
        const { error, callId } = payload;
        if (pendingSyscalls.has(callId)) {
            pendingSyscalls.get(callId).reject(new Error(error));
            pendingSyscalls.delete(callId);
        }
    }
};

// Funcția principală care rulează logica procesului
async function run() {
    try {
        const module = await import(`/js/bin/${procInfo.name}.js`);
        if (typeof module.logic !== 'function') {
             throw new Error(`Command '${procInfo.name}' logic is not a valid function.`);
        }
        
        // Injectăm funcția 'syscall' în contextul pe care îl va primi procesul
        const context = {
            args: procInfo.args,
            cwd,
            stdin: procInfo.stdin || null,
            syscall
        };

        // Rulăm logica procesului
        const iterator = module.logic(context);

        let result = await iterator.next();
        while (!result.done) {
            const value = result.value;

            // Procesele acum fac 'yield' pe obiecte simple, nu pe syscall-uri
            if (value && value.type === 'stdout') {
                self.postMessage({ type: 'stdout', payload: { data: value.data } });
            }
            
            result = await iterator.next();
        }

        self.postMessage({ type: 'exit', payload: { exitCode: 0 } });

    } catch (e) {
        self.postMessage({ type: 'error', payload: { message: e.message } });
        self.postMessage({ type: 'exit', payload: { exitCode: 1 } });
    }
}