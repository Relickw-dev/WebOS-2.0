// File: js/boot/utils.js (Optimized and Cleaned)

// =================================================================================================
// # NETWORK UTILITIES
// =================================================================================================

/**
 * Checks if the backend server is online and responding to requests.
 * Uses a timeout to prevent indefinite waiting.
 * @returns {Promise<boolean>} `true` if the server is online, `false` otherwise.
 */
export async function checkServerStatus() {
    try {
        // `AbortSignal.timeout` is a modern and clean way to cancel a fetch request after a certain period.
        const response = await fetch('http://localhost:3000/api/commands', {
            signal: AbortSignal.timeout(2000)
        });
        return response.ok; // `response.ok` is true for HTTP statuses in the 200-299 range.
    } catch (error) {
        console.error('Server status check failed:', error.message);
        return false;
    }
}

// =================================================================================================
// # TEXT PROCESSING & PARSING
// =================================================================================================

/**
 * Parses a configuration text (similar to INI format) into a JavaScript object.
 * Supports `[SectionName]` sections and `key=value` pairs.
 * Ignores empty lines and comments (lines starting with `#`).
 * @param {string} text - The text content of the configuration file.
 * @returns {object} A configuration object with an `entries` property containing the sections.
 */
export function parseConfig(text) {
    const config = { entries: {} };
    let currentSection = null;

    // Regular expressions to more clearly identify line types
    const sectionRegex = /^\s*\[\s*([^\]]+)\s*\]\s*$/; // Identifies a [Section] type line
    const keyValueRegex = /^\s*([^=]+?)\s*=\s*(.*)\s*$/; // Identifies a key=value type line
    const commentOrEmptyRegex = /^\s*#|^\s*$/; // Identifies a comment or an empty line

    text.split('\n').forEach(line => {
        if (commentOrEmptyRegex.test(line)) {
            return; // Ignore comments and empty lines
        }

        const sectionMatch = line.match(sectionRegex);
        if (sectionMatch) {
            currentSection = sectionMatch[1]; // Extract the section name
            config.entries[currentSection] = {};
            return;
        }

        const keyValueMatch = line.match(keyValueRegex);
        if (keyValueMatch) {
            const [, key, value] = keyValueMatch;
            if (currentSection) {
                config.entries[currentSection][key] = value;
            } else {
                config[key] = value; // Global key-value pair (before the first section)
            }
        }
    });

    return config;
}

// =================================================================================================
// # CRYPTOGRAPHIC UTILITIES (Simulated)
// =================================================================================================

/**
 * Generates a numeric checksum (simulated) from a string using the djb2 algorithm.
 * This function is purely cosmetic and should not be used for security.
 * @param {string} [str=''] - The input string.
 * @returns {string} A checksum in hexadecimal format, e.g., "0x1A2B3C4D".
 */
export function generateChecksum(str = '') {
    // Ensure the input is a string
    const inputStr = String(str || '');
    let hash = 0;

    for (let i = 0; i < inputStr.length; i++) {
        const char = inputStr.charCodeAt(i);
        // The djb2 hashing algorithm, a common and simple variant.
        // `(hash << 5) - hash` is an optimization for `hash * 31`.
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to a 32-bit signed integer.
    }

    // `toString(16)` converts the number to its hexadecimal representation.
    return `0x${Math.abs(hash).toString(16).toUpperCase()}`;
}