// File: js/boot/utils.js

/**
 * Verifică dacă serverul backend este online.
 */
export async function checkServerStatus() {
    try {
        const response = await fetch('http://localhost:3000/api/commands', { signal: AbortSignal.timeout(2000) });
        return response.ok;
    } catch (error) {
        console.error('Server status check failed:', error.message);
        return false;
    }
}

/**
 * Parsează configurația complexă cu secțiuni.
 */
export function parseConfig(text) {
    const config = { entries: {} };
    let currentSection = null;
    text.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('#') || !line) return;
        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.substring(1, line.length - 1);
            config.entries[currentSection] = {};
        } else {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length) {
                const value = valueParts.join('=').trim();
                if (currentSection) config.entries[currentSection][key.trim()] = value;
                else config[key.trim()] = value;
            }
        }
    });
    return config;
}

/**
 * Funcție cosmetică pentru a genera un checksum fals.
 */
export function generateChecksum(str = '') {
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return `0x${Math.abs(hash).toString(16).toUpperCase()}`;
}