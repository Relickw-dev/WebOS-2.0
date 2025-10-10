// File: server/api/vfs.js
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

const router = express.Router();
const virtualRoot = path.join(__dirname, '..', '..', 'fs_root');

// --- UTILITARE ---

/** Asigură că o cale este sigură și se află în interiorul virtualRoot. */
function getFullPath(filePath) {
  const normalizedPath = path.normalize(path.join('/', filePath));
  const fullPath = path.join(virtualRoot, normalizedPath);
  if (!fullPath.startsWith(virtualRoot)) {
    throw new Error('Access denied. Path traversal attempt detected.');
  }
  return fullPath;
}

/** Verifică permisiunile unui utilizator asupra unui fișier/director. */
async function checkPermission(filePath, user, action) {
  if (path.normalize(filePath) === '/' || path.normalize(filePath) === '.') return true;

  const fullPath = getFullPath(filePath);
  const dirPath = path.dirname(fullPath);
  const metaPath = path.join(dirPath, `.${path.basename(fullPath)}.meta`);

  try {
    const metaContent = await fs.readFile(metaPath, 'utf8');
    const meta = JSON.parse(metaContent);

    if (meta.owner === user) {
      const perms = meta.permissions.substring(0, 3);
      if (action === 'read' && !perms.includes('r')) return false;
      if (action === 'write' && !perms.includes('w')) return false;
      if (action === 'execute' && !perms.includes('x')) return false;
      return true;
    }

    const others = meta.permissions.substring(6);
    if (action === 'read' && !others.includes('r')) return false;
    if (action === 'write' && !others.includes('w')) return false;
    if (action === 'execute' && !others.includes('x')) return false;
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return true;
    throw err;
  }
}

// --- ENDPOINTS ---

// GET /api/vfs/readdir
router.get('/readdir', async (req, res) => {
  const targetPath = req.query.path || '/';
  const longFormat = req.query.long === 'true';
  const user = req.query.user || 'user';

  try {
    if (!(await checkPermission(targetPath, user, 'read'))) {
      return res.status(403).json({ error: `ls: cannot open directory '${targetPath}': Permission denied` });
    }

    const fullPath = getFullPath(targetPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });

    const fileList = await Promise.all(
      entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(async entry => {
          const entryInfo = {
            name: entry.name,
            type: entry.isDirectory() ? 'dir' : 'file',
          };
          if (longFormat) {
            const metaPath = path.join(fullPath, `.${entry.name}.meta`);
            try {
              const metaContent = await fs.readFile(metaPath, 'utf8');
              entryInfo.meta = JSON.parse(metaContent);
            } catch {
              entryInfo.meta = { owner: 'unknown', group: 'unknown', permissions: '---------' };
            }
          }
          return entryInfo;
        })
    );

    res.json(fileList);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vfs/stat
router.get('/stat', async (req, res) => {
  const { path: targetPath, user = 'user' } = req.query;

  try {
    if (!(await checkPermission(targetPath, user, 'read'))) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    const fullPath = getFullPath(targetPath);
    const stats = await fs.stat(fullPath);

    res.json({
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
    });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: 'No such file or directory' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/vfs/read
router.get('/read', async (req, res) => {
  const { path: targetPath, user = 'user' } = req.query;

  try {
    if (!targetPath) return res.status(400).json({ error: 'Path is required' });
    if (!(await checkPermission(targetPath, user, 'read'))) {
      return res.status(403).json({ error: `cat: ${targetPath}: Permission denied` });
    }

    const fullPath = getFullPath(targetPath);
    const content = await fs.readFile(fullPath, 'utf8');
    res.send(content);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: `cat: ${targetPath}: No such file or directory` });
    if (err.code === 'EISDIR') return res.status(400).json({ error: `cat: ${targetPath}: Is a directory` });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/write
router.post('/write', async (req, res) => {
  const { path: filePath, content, append, user = 'user' } = req.body;
  const flags = append ? 'a' : 'w';

  try {
    if (typeof filePath !== 'string' || content === undefined) {
      return res.status(400).json({ error: 'Path and content are required.' });
    }

    const dirOfFile = path.dirname(filePath);
    if (!(await checkPermission(dirOfFile, user, 'write'))) {
      return res.status(403).json({ error: `write: cannot create file in ‘${dirOfFile}’: Permission denied` });
    }

    const fullPath = getFullPath(filePath);
    const dirPath = path.dirname(fullPath);
    const metaPath = path.join(dirPath, `.${path.basename(fullPath)}.meta`);

    await fs.mkdir(dirPath, { recursive: true });
    await fs.writeFile(fullPath, content, { encoding: 'utf8', flag: flags });

    try {
      await fs.access(metaPath);
    } catch {
      const defaultMeta = { owner: user, group: 'users', permissions: 'rw-r--r--' };
      await fs.writeFile(metaPath, JSON.stringify(defaultMeta, null, 2));
    }

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: `write: cannot create file ‘${filePath}’: No such file or directory` });
    if (err.code === 'EISDIR') return res.status(400).json({ error: `write: cannot write to ‘${filePath}’: It is a directory` });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/mkdir
router.post('/mkdir', async (req, res) => {
  const { path: dirPath, user = 'user' } = req.body;

  try {
    if (!dirPath) return res.status(400).json({ error: 'Path is required' });

    const parentOfDir = path.dirname(dirPath);
    if (!(await checkPermission(parentOfDir, user, 'write'))) {
      return res.status(403).json({ error: `mkdir: cannot create directory ‘${dirPath}’: Permission denied` });
    }

    const fullPath = getFullPath(dirPath);
    const parentDir = path.dirname(fullPath);
    const metaPath = path.join(parentDir, `.${path.basename(fullPath)}.meta`);

    await fs.mkdir(fullPath);
    const defaultMeta = { owner: user, group: 'users', permissions: 'rwxr-xr-x' };
    await fs.writeFile(metaPath, JSON.stringify(defaultMeta, null, 2));

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'EEXIST') return res.status(409).json({ error: `mkdir: cannot create directory ‘${dirPath}’: File exists` });
    if (err.code === 'ENOENT') return res.status(404).json({ error: `mkdir: cannot create directory ‘${dirPath}’: No such file or directory` });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/vfs/rm
router.delete('/rm', async (req, res) => {
  const { path: targetPath, recursive, user = 'user' } = req.body;

  try {
    if (!targetPath) return res.status(400).json({ error: 'Path is required' });
    if (!(await checkPermission(targetPath, user, 'write'))) {
      return res.status(403).json({ error: `rm: cannot remove '${targetPath}': Permission denied` });
    }

    const fullPath = getFullPath(targetPath);
    await fs.rm(fullPath, { recursive: !!recursive });

    const parentDir = path.dirname(fullPath);
    const metaPath = path.join(parentDir, `.${path.basename(fullPath)}.meta`);
    try {
      await fs.rm(metaPath);
    } catch (metaErr) {
      if (metaErr.code !== 'ENOENT') console.warn(`Could not remove meta file ${metaPath}`);
    }

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: `rm: cannot remove '${targetPath}': No such file or directory` });
    if (err.code === 'EISDIR' && !recursive) return res.status(400).json({ error: `rm: cannot remove '${targetPath}': Is a directory` });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/copy
router.post('/copy', async (req, res) => {
  const { source, destination, recursive, user = 'user' } = req.body;

  try {
    if (!source || !destination) return res.status(400).json({ error: 'Source and destination are required' });

    if (!(await checkPermission(source, user, 'read'))) {
      return res.status(403).json({ error: `cp: cannot stat '${source}': Permission denied` });
    }
    if (!(await checkPermission(path.dirname(destination), user, 'write'))) {
      return res.status(403).json({ error: `cp: cannot create file in '${path.dirname(destination)}': Permission denied` });
    }

    const sourcePath = getFullPath(source);
    const destinationPath = getFullPath(destination);
    await fs.cp(sourcePath, destinationPath, { recursive: !!recursive });

    const destParentDir = path.dirname(destinationPath);
    const destMetaPath = path.join(destParentDir, `.${path.basename(destinationPath)}.meta`);
    const sourceStats = await fs.stat(sourcePath);
    const newMeta = {
      owner: user,
      group: 'users',
      permissions: sourceStats.isDirectory() ? 'rwxr-xr-x' : 'rw-r--r--',
    };
    await fs.writeFile(destMetaPath, JSON.stringify(newMeta, null, 2));

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ERR_FS_CP_DIR_TO_NON_DIR' || (err.code === 'EISDIR' && !recursive)) {
      return res.status(400).json({ error: `cp: -r not specified; omitting directory '${source}'` });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/move
router.post('/move', async (req, res) => {
  const { source, destination, user = 'user' } = req.body;

  try {
    if (!source || !destination) return res.status(400).json({ error: 'Source and destination are required' });

    if (!(await checkPermission(source, user, 'write'))) {
      return res.status(403).json({ error: `mv: cannot move '${source}': Permission denied` });
    }
    if (!(await checkPermission(path.dirname(destination), user, 'write'))) {
      return res.status(403).json({ error: `mv: cannot move to '${path.dirname(destination)}': Permission denied` });
    }

    const sourcePath = getFullPath(source);
    let destinationPath = getFullPath(destination);

    const sourceParentDir = path.dirname(sourcePath);
    const sourceMetaPath = path.join(sourceParentDir, `.${path.basename(sourcePath)}.meta`);

    let destStats = null;
    try {
      destStats = await fs.stat(destinationPath);
    } catch {}

    if (destStats && destStats.isDirectory()) {
      destinationPath = path.join(destinationPath, path.basename(sourcePath));
    }

    const destParentDir = path.dirname(destinationPath);
    const destMetaPath = path.join(destParentDir, `.${path.basename(destinationPath)}.meta`);

    await fs.rename(sourcePath, destinationPath);
    try {
      await fs.rename(sourceMetaPath, destMetaPath);
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn(`Could not move meta file for ${source}`);
    }

    res.json({ success: true });
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: `mv: cannot stat '${source}': No such file or directory` });
    if (err.code === 'ENOTDIR') return res.status(400).json({ error: `mv: cannot move '${source}' to a non-directory` });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/grep
router.post('/grep', async (req, res) => {
  const { path: targetPath, pattern, user = 'user' } = req.body;

  try {
    if (!targetPath || pattern === undefined) return res.status(400).json({ error: 'Path and pattern are required' });

    if (!(await checkPermission(targetPath, user, 'read'))) {
      return res.status(403).json({ error: `grep: ${targetPath}: Permission denied` });
    }

    const fullPath = getFullPath(targetPath);
    const content = await fs.readFile(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const matchingLines = lines.filter(line => line.includes(pattern));
    res.json(matchingLines);
  } catch (err) {
    if (err.code === 'ENOENT') return res.status(404).json({ error: `grep: ${targetPath}: No such file or directory` });
    if (err.code === 'EISDIR') return res.status(400).json({ error: `grep: ${targetPath}: Is a directory` });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/vfs/chmod
router.post('/chmod', async (req, res) => {
  const { path: targetPath, mode, user = 'user' } = req.body;

  try {
    if (!targetPath || !mode) return res.status(400).json({ error: 'Path and mode are required' });

    const fullPath = getFullPath(targetPath);
    const parentDir = path.dirname(fullPath);
    const metaPath = path.join(parentDir, `.${path.basename(fullPath)}.meta`);

    let meta;
    try {
      const metaContent = await fs.readFile(metaPath, 'utf8');
      meta = JSON.parse(metaContent);
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: 'No such file or directory' });
      throw err;
    }

    if (meta.owner !== user) return res.status(403).json({ error: 'Operation not permitted' });

    const permissions = mode
      .split('')
      .map(digit => {
        const d = parseInt(digit, 8);
        return `${(d & 4) ? 'r' : '-'}${(d & 2) ? 'w' : '-'}${(d & 1) ? 'x' : '-'}`;
      })
      .join('');

    meta.permissions = permissions;
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
