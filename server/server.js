// File: server/server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs/promises');
const vfsApi = require('./api/vfs');

const app = express();
const port = 3000;
const virtualRoot = path.join(__dirname, '..', 'fs_root');

app.use(cors());
app.use(express.json());
app.use('/api/vfs', vfsApi);
app.use(express.static(path.join(__dirname, '..', 'public'))); // presupunem că fișierele frontend sunt în 'public'

async function start() {
  await fs.mkdir(virtualRoot, { recursive: true });
  console.log(`Server listening on http://localhost:${port}, serving VFS root: ${virtualRoot}`);
  app.listen(port, () => console.log('Server started.'));
}

start().catch(e => { console.error(e); process.exit(1); });