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

// --- MODIFICARE CHEIE: Am transformat în funcție async și am folosit await ---
app.get('/api/commands', async (req, res) => {
    const binPath = path.join(__dirname, '..', 'js', 'bin');
    
    try {
        const files = await fs.readdir(binPath);
        
        const commandNames = files
            .filter(file => file.endsWith('.js'))
            .map(file => file.slice(0, -3));

        res.json(commandNames);
    } catch (err) {
        console.error('Eroare la citirea directorului js/bin:', err);
        res.status(500).json({ error: 'Nu s-au putut prelua comenzile.' });
    }
});

app.use(express.static(path.join(__dirname, '..'))); // Servim direct din rădăcina proiectului

async function start() {
  await fs.mkdir(virtualRoot, { recursive: true });
  console.log(`Server listening on http://localhost:${port}, serving VFS root: ${virtualRoot}`);
  app.listen(port, () => console.log('Server started.'));
}

start().catch(e => { console.error(e); process.exit(1); });