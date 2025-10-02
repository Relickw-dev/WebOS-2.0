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
    if (!targetPath) {
        return res.status(400).json({ error: 'Path is required' });
    }
    const fullPath = getFullPath(targetPath);
    const content = await fs.readFile(fullPath, 'utf8');
    // Important: Trimitem conținutul ca text, nu ca JSON
    res.send(content); 
  } catch (err) {
    if (err.code === 'ENOENT') {
        res.status(404).json({ error: `cat: ${targetPath}: No such file or directory` });
    } else if (err.code === 'EISDIR') {
        res.status(400).json({ error: `cat: ${targetPath}: Is a directory` });
    }
    else {
        res.status(500).json({ error: err.message });
    }
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

router.delete('/rm', async (req, res) => {
  const { path: targetPath, recursive } = req.body;
  try {
    if (!targetPath) {
      return res.status(400).json({ error: 'Path is required' });
    }
    const fullPath = getFullPath(targetPath);

    // Folosim fs.rm care poate șterge atât fișiere, cât și directoare (dacă recursive: true)
    await fs.rm(fullPath, { recursive: !!recursive }); // !!recursive convertește valoarea în boolean
    
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: `rm: cannot remove '${targetPath}': No such file or directory` });
    } else if (err.code === 'ENOTDIR' && !recursive) {
        // Aceasta eroare nu ar trebui sa apara cu fs.rm, dar o prindem preventiv
        res.status(400).json({ error: `rm: cannot remove '${targetPath}': Not a directory` });
    }
     else if (err.code === 'EISDIR' && !recursive) {
        // Eroare specifică pentru când încercăm să ștergem un director fără -r
        res.status(400).json({ error: `rm: cannot remove '${targetPath}': Is a directory` });
    }
    else {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/vfs/copy
router.post('/copy', async (req, res) => {
  const { source, destination, recursive } = req.body;

  try {
    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination are required' });
    }

    const sourcePath = getFullPath(source);
    const destinationPath = getFullPath(destination);

    // Verificăm dacă sursa există
    try {
      await fs.access(sourcePath);
    } catch (e) {
      return res.status(404).json({ error: `cp: cannot stat '${source}': No such file or directory` });
    }

    // Utilizăm fs.cp, care gestionează recursivitatea automat
    await fs.cp(sourcePath, destinationPath, { recursive: !!recursive });
    res.json({ success: true });

  } catch (err) {
    // fs.cp aruncă eroare dacă sursa e director și recursive e false
    if (err.code === 'ERR_FS_CP_DIR_TO_NON_DIR' || (err.code === 'EISDIR' && !recursive)) {
      res.status(400).json({ error: `cp: -r not specified; omitting directory '${source}'` });
    } else {
      res.status(500).json({ error: err.message });
    }
  }
});

router.post('/move', async (req, res) => {
  const { source, destination } = req.body;

  try {
    if (!source || !destination) {
      return res.status(400).json({ error: 'Source and destination are required' });
    }

    const sourcePath = getFullPath(source);
    let destinationPath = getFullPath(destination);

    // Verificăm dacă sursa există
    try {
      await fs.access(sourcePath);
    } catch (e) {
      return res.status(404).json({ error: `mv: cannot stat '${source}': No such file or directory` });
    }

    // Verificăm dacă destinația este un director existent
    try {
      const destStats = await fs.stat(destinationPath);
      if (destStats.isDirectory()) {
        // Dacă da, construim calea finală pentru a muta sursa *înăuntrul* directorului
        destinationPath = path.join(destinationPath, path.basename(sourcePath));
      }
    } catch (e) {
      // Ignorăm eroarea dacă destinația nu există (înseamnă că este o redenumire)
    }

    // Folosim fs.rename, care este eficient atât pentru fișiere, cât și pentru directoare
    await fs.rename(sourcePath, destinationPath);
    res.json({ success: true });

  } catch (err) {
    // Gestionăm erori specifice, cum ar fi mutarea unui director într-un fișier
    if (err.code === 'ENOTDIR') {
        res.status(400).json({ error: `mv: cannot move '${source}' to a non-directory` });
    } else if (err.code === 'EPERM' || err.code === 'EXDEV') {
        res.status(500).json({ error: `mv: cannot move '${source}' across devices or partitions (not supported)` });
    }
    else {
        res.status(500).json({ error: err.message });
    }
  }
});

router.post('/grep', async (req, res) => {
    const { path: targetPath, pattern } = req.body;

    try {
        if (!targetPath || pattern === undefined) {
            return res.status(400).json({ error: 'Path and pattern are required' });
        }
        
        const fullPath = getFullPath(targetPath);
        const content = await fs.readFile(fullPath, 'utf8');
        const lines = content.split(/\r?\n/);

        const matchingLines = lines.filter(line => line.includes(pattern));

        res.json(matchingLines); // Returnăm un array de linii care se potrivesc

    } catch (err) {
        if (err.code === 'ENOENT') {
            res.status(404).json({ error: `grep: ${targetPath}: No such file or directory` });
        } else if (err.code === 'EISDIR') {
            res.status(400).json({ error: `grep: ${targetPath}: Is a directory` });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

module.exports = router;