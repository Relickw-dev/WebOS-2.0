

// File: js/vfs/client.js
const API_BASE_URL = 'http://localhost:3000/api/vfs';

async function fetchApi(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Server error');
    }
    return response.json();
}

export const vfsClient = {
    readDir: async (path) => fetchApi(`/readdir?path=${encodeURIComponent(path)}`),
    stat: async (path) => fetchApi(`/stat?path=${encodeURIComponent(path)}`),
    readFile: async (path) => {
        const response = await fetch(`${API_BASE_URL}/read?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Server error');
        }
        return response.text(); // Așteptăm text, nu JSON
    },
    
    
    writeFile: async (path, content, append = false) => {
        const requestBody = { path, content, append };

        // --- PUNCT DE DEPANARE ---
        // Această linie va afișa în consola browserului exact ce se trimite către server.
        console.log('Sending to /write:', JSON.stringify(requestBody));

        return fetchApi(`/write`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
    },
    mkdir: async (path) => {
        return fetchApi('/mkdir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path })
        });
    },
    rm: async (path, recursive = false) => {
        return fetchApi('/rm', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, recursive })
        });
    },
    copyFile: async (source, destination, recursive = false) => {
        return fetchApi('/copy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination, recursive })
        });
    },
    move: async (source, destination) => {
        return fetchApi('/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source, destination })
        });
    },
    grep: async (path, pattern) => {
        return fetchApi('/grep', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, pattern })
        });
    },
};