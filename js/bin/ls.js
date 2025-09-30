// File: js/bin/ls
import { syscall } from '../kernel/syscalls.js';
import { logger } from '../utils/logger.js';

export default async function ls(args, context) {
    const { stdout, cwd } = context;
    try {
        const files = await syscall('vfs.readDir', { path: cwd });
        
        // Verifică dacă `files` este un array și are elemente
        if (Array.isArray(files) && files.length > 0) {
            // Iterează prin fiecare obiect de fișier și afișează doar proprietatea 'name'
            files.forEach(file => {
                stdout.write({ message: file.name });
            });
        } else {
            stdout.write({ message: 'No files found.' });
        }

    } catch (e) {
        stdout.write({ type: 'error', message: `ls: ${e.message}` });
    }
}