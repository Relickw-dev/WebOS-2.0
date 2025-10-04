// File: js/bin/kill.js
export const logic = async function*({ args }) {
    // Check if a PID was provided
    if (!args || args.length === 0) {
        yield { type: 'stdout', data: { type: 'error', message: 'Usage: kill [pid]' } };
        return;
    }

    const pid = parseInt(args[0], 10);
    if (isNaN(pid)) {
        yield { type: 'stdout', data: { type: 'error', message: `kill: invalid pid: ${args[0]}` } };
        return;
    }

    try {
        // Call the new syscall to terminate the process
        yield { type: 'syscall', name: 'proc.kill', params: { pid } };
        yield { type: 'stdout', data: { message: `Process ${pid} has been terminated.` } };
    } catch (e) {
        // Display errors if the syscall fails (e.g., non-existent PID)
        yield { type: 'stdout', data: { type: 'error', message: e.message } };
    }
};