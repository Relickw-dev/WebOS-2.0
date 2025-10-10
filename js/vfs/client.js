// File: js/vfs/client.js
const API_BASE_URL = 'http://localhost:3000/api/vfs';

/**
 * Wrapper generic pentru API-ul fetch, cu gestionarea erorilor.
 * @param {string} endpoint - Calea API (ex: '/readdir').
 * @param {object} options - Opțiunile standard pentru 'fetch'.
 * @returns {Promise<any>} - Răspunsul JSON de la server.
 */
async function fetchApi(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        const error = await response.json();
        // Aruncăm eroarea primită de la server pentru a fi gestionată de syscall
        throw new Error(error.error || `Server error: ${response.status}`);
    }
    // Pentru 'readFile' care returnează text, 'response.json()' va eșua.
    // Verificăm Content-Type pentru a decide cum să procesăm răspunsul.
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
        return response.json();
    }
    return response.text();
}

export const vfsClient = {
    /**
     * Citește conținutul unui director.
     * @param {string} path - Calea către director.
     * @param {string} user - Utilizatorul care execută comanda.
     * @param {boolean} long - Flag pentru formatul lung (ls -l).
     */
    readDir: async (path, user, long = false) => {
        const query = `?path=${encodeURIComponent(path)}&user=${encodeURIComponent(user)}&long=${long}`;
        return fetchApi(`/readdir${query}`);
    },

    /**
     * Obține metadatele unui fișier/director.
     * @param {string} path - Calea către fișier/director.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    stat: async (path, user) => {
        const query = `?path=${encodeURIComponent(path)}&user=${encodeURIComponent(user)}`;
        return fetchApi(`/stat${query}`);
    },

    /**
     * Citește conținutul textual al unui fișier.
     * @param {string} path - Calea către fișier.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    readFile: async (path, user) => {
        const query = `?path=${encodeURIComponent(path)}&user=${encodeURIComponent(user)}`;
        return fetchApi(`/read${query}`);
    },
    
    /**
     * Scrie conținut într-un fișier.
     * @param {string} path - Calea către fișier.
     * @param {string} content - Conținutul de scris.
     * @param {boolean} append - Dacă se adaugă la finalul fișierului.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    writeFile: async (path, content, append = false, user) => {
        return fetchApi(`/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content, append, user })
        });
    },

    /**
     * Creează un director nou.
     * @param {string} path - Calea unde se creează directorul.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    mkdir: async (path, user) => {
        return fetchApi('/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, user })
        });
    },

    /**
     * Șterge un fișier sau un director.
     * @param {string} path - Calea de șters.
     * @param {boolean} recursive - Flag pentru ștergere recursivă (rm -r).
     * @param {string} user - Utilizatorul care execută comanda.
     */
    rm: async (path, recursive = false, user) => {
        return fetchApi('/rm', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, recursive, user })
        });
    },

    /**
     * Copiază un fișier sau un director.
     * @param {string} source - Calea sursă.
     * @param {string} destination - Calea destinație.
     * @param {boolean} recursive - Flag pentru copiere recursivă.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    copyFile: async (source, destination, recursive = false, user) => {
        return fetchApi('/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination, recursive, user })
        });
    },

    /**
     * Mută/redenumeste un fișier sau director.
     * @param {string} source - Calea sursă.
     * @param {string} destination - Calea destinație.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    move: async (source, destination, user) => {
        return fetchApi('/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination, user })
        });
    },

    /**
     * Caută un text într-un fișier.
     * @param {string} path - Calea către fișier.
     * @param {string} pattern - Textul de căutat.
     * @param {string} user - Utilizatorul care execută comanda.
     */
    grep: async (path, pattern, user) => {
        return fetchApi('/grep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, pattern, user })
        });
    },

    /**
     * NOU: Schimbă permisiunile unui fișier.
     * @param {string} path - Calea către fișier.
     * @param {string} mode - Modul octal (ex: "755").
     * @param {string} user - Utilizatorul care execută comanda.
     */
    chmod: async (path, mode, user) => {
        return fetchApi('/chmod', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, mode, user })
        });
    }
};