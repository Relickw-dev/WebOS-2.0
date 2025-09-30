// File: server/api/vfs.js
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const router = express.Router();
const virtualRoot = path.join(__dirname, '..', '..', 'fs_root');

// Utilitar pentru a asigura că calea este sigură
function getFullPath(filePath) {
  const fullPath = path.join(virtualRoot, filePath);
  if (!fullPath.startsWith(virtualRoot)) {
    throw new Error('Access denied. Path traversal attempt detected.');
  }
  return fullPath;
}

// GET /api/vfs/readdir
router.get('/readdir', async (req, res) => {
  const targetPath = req.query.path || '/';
  try {
    const fullPath = getFullPath(targetPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const fileList = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'dir' : 'file',
    }));
    res.json(fileList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vfs/stat - IMPLEMENTARE ÎMBUNĂTĂȚITĂ
router.get('/stat', async (req, res) => {
  const targetPath = req.query.path;
  try {
    const fullPath = getFullPath(targetPath);
    console.log(`Checking path: ${fullPath}`); // Log util pentru depanare
    const stats = await fs.stat(fullPath);
    console.log(`Path exists, is directory: ${stats.isDirectory()}`); // Log util pentru a vedea tipul
    
    res.json({
      type: stats.isDirectory() ? 'directory' : 'file', // Folosesc 'directory' pentru claritate
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
    });
  } catch (err) {
    if (err.code === 'ENOENT') {
        res.status(404).json({ error: 'No such file or directory' });
    } else if (err.code === 'ENOTDIR') {
        // Această eroare nu ar trebui să apară aici, dar e bine să o prindem
        res.status(400).json({ error: 'Path is not a directory' });
    } else {
        res.status(500).json({ error: err.message });
    }
  }
});


// GET /api/vfs/read
router.get('/read', async (req, res) => {
  const targetPath = req.query.path;
  try {
    const fullPath = getFullPath(targetPath);
    const content = await fs.readFile(fullPath, 'utf8');
    res.send(content);
  } catch (err) {
    res.status(404).json({ error: 'No such file or directory' });
  }
});

// POST /api/vfs/write
router.post('/write', async (req, res) => {
  const { path: filePath, content, append } = req.body;
  const flags = append ? 'a' : 'w';

  try {
    // Validare de bază pentru a ne asigura că primim datele necesare
    if (typeof filePath !== 'string' || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required.' });
    }

    const fullPath = getFullPath(filePath);
    const dirPath = path.dirname(fullPath);

    // Pasul cheie: Asigură-te că directorul părinte există.
    // `{ recursive: true }` funcționează ca `mkdir -p`, creând toate directoarele necesare.
    await fs.mkdir(dirPath, { recursive: true });

    // Acum putem scrie fișierul în siguranță
    await fs.writeFile(fullPath, content, { encoding: 'utf8', flag: flags });
    res.json({ success: true });

  } catch (err) {
    // Gestionare îmbunătățită a erorilor pentru a oferi feedback util
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: `write: cannot create file ‘${filePath}’: No such file or directory` });
    } else if (err.code === 'EISDIR') {
      res.status(400).json({ error: `write: cannot write to ‘${filePath}’: It is a directory` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/vfs/mkdir
router.post('/mkdir', async (req, res) => {
  const { path: dirPath } = req.body;
  try {
    if (!dirPath) {
        return res.status(400).json({ error: 'Path is required' });
    }
    const fullPath = getFullPath(dirPath);
    // Nu folosim { recursive: true } pentru a imita comportamentul standard 'mkdir'
    // care eșuează dacă părintele nu există.
    await fs.mkdir(fullPath); 
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'EEXIST') {
        res.status(409).json({ error: `mkdir: cannot create directory ‘${dirPath}’: File exists` });
    } else if (err.code === 'ENOENT') {
        res.status(404).json({ error: `mkdir: cannot create directory ‘${dirPath}’: No such file or directory` });
    }
    else {
        res.status(500).json({ error: err.message });
    }
  }
});

module.exports = router;