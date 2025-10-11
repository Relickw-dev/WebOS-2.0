// File: server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises'); // Corect, folosim varianta cu promises
const vfsApi = require('./api/vfs');

const app = express();
const port = 3000;
const virtualRoot = path.join(__dirname, '..', 'fs_root');

app.use(cors());
app.use(express.json());
app.use('/api/vfs', vfsApi);

// Endpoint care returnează comenzile disponibile
app.get('/api/commands', async (req, res) => {
    const binPath = path.join(__dirname, '..', 'js', 'bin');
    
    try {
        // Verificăm dacă directorul `bin` există, pentru a evita erori la pornire
        await fs.access(binPath);
        const files = await fs.readdir(binPath);
        
        const commandNames = files
            .filter(file => file.endsWith('.js'))
            .map(file => file.slice(0, -3));

        res.json(commandNames);
    } catch (err) {
        // Dacă directorul nu există (caz normal), returnăm un array gol.
        if (err.code === 'ENOENT') {
            console.warn('Directorul js/bin nu a fost găsit. Se returnează o listă goală de comenzi.');
            res.json([]);
            return;
        }
        console.error('Eroare la citirea directorului js/bin:', err);
        res.status(500).json({ error: 'Nu s-au putut prelua comenzile.' });
    }
});

app.post('/api/authenticate', async (req, res) => {
    // Extragem username-ul și parola din corpul cererii (request body)
    const { username, password } = req.body;

    // Verificăm dacă am primit datele necesare
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    try {
        // Importăm modulul de autentificare
        const auth = require('./auth.js');
        
        // Folosim funcția 'authenticate' pentru a verifica datele
        const isValid = await auth.authenticate(username, password);

        // Răspundem în funcție de rezultat
        if (isValid) {
            // Dacă datele sunt corecte, trimitem un răspuns de succes
            res.json({ success: true });
        } else {
            // Dacă datele sunt greșite, trimitem o eroare de autentificare (401)
            res.status(401).json({ success: false, message: 'Invalid credentials.' });
        }
    } catch (err) {
        // În caz de eroare neașteptată pe server
        console.error('Authentication error:', err);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.get('/api/users', (req, res) => {
    try {
        const auth = require('./auth.js');
        const userList = auth.getUsers ? auth.getUsers() : Object.keys(auth.users);
        res.json(userList);
    } catch (err) {
        console.error('Error getting users:', err);
        res.status(500).json({ error: 'Could not retrieve users.' });
    }
});
// ==========================================================

app.use(express.static(path.join(__dirname, '..'))); // Servim direct din rădăcina proiectului

async function start() {
  await fs.mkdir(virtualRoot, { recursive: true });
  console.log(`Server listening on http://localhost:${port}, serving VFS root: ${virtualRoot}`);
  app.listen(port, () => console.log('Server started.'));
}

start().catch(e => { console.error(e); process.exit(1); });