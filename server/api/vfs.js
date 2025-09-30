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

// GET /api/vfs/stat
router.get('/stat', async (req, res) => {
  const targetPath = req.query.path;
  try {
    const fullPath = getFullPath(targetPath);
    const stats = await fs.stat(fullPath);
    res.json({
      type: stats.isDirectory() ? 'dir' : 'file',
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
    });
  } catch (err) {
    res.status(404).json({ error: 'No such file or directory' });
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
    const fullPath = getFullPath(filePath);
    await fs.writeFile(fullPath, content, { encoding: 'utf8', flag: flags });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/mkdir
router.post('/mkdir', async (req, res) => {
  const { path: dirPath } = req.body;
  try {
    const fullPath = getFullPath(dirPath);
    await fs.mkdir(fullPath, { recursive: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;