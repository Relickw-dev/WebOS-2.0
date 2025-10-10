// File: server/api/vfs.js
const express = require('express');
const path = require('path');
const fs = require('fs/promises');

// Asigură-te că ai creat fișierul 'server/auth.js'
// Acesta trebuie să exporte funcția getUserGroups(user).
const { getUserGroups, getUsers } = require('../auth.js');

const router = express.Router();
const virtualRoot = path.join(__dirname, '..', '..', 'fs_root');
const DEFAULT_USER = 'guest'; // User implicit pentru securitate

// --- UTILITARE ---

function getFullPath(filePath) {
    const normalizedPath = path.normalize(path.join('/', filePath));
    const fullPath = path.join(virtualRoot, normalizedPath);
    if (!fullPath.startsWith(virtualRoot)) {
        throw new Error('Access denied. Path traversal attempt detected.');
    }
    return fullPath;
}

async function getMeta(fullPath) {
    const metaPath = path.join(path.dirname(fullPath), `.${path.basename(fullPath)}.meta`);
    try {
        const metaContent = await fs.readFile(metaPath, 'utf8');
        return JSON.parse(metaContent);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return null;
        }
        throw err;
    }
}

/**
 * Verifică permisiunile (LOGICĂ CORECTATĂ)
 */
async function checkPermission(filePath, user, action) {
    // 1. 'root' are întotdeauna acces. Aceasta este prima și cea mai importantă verificare.
    if (user === 'root') {
        return true;
    }

    const normalizedFilePath = path.normalize(filePath);
    // 2. Pentru directorul rădăcină, permitem doar acțiuni de citire ('read') pentru alți utilizatori.
    if (normalizedFilePath === '/' || normalizedFilePath === '.') {
        return action === 'read';
    }

    const fullPath = getFullPath(filePath);
    const meta = await getMeta(fullPath);

    // 3. Dacă un fișier nu are metadate, este considerat "read-only" pentru siguranță.
    if (!meta) {
        return action === 'read';
    }

    const userGroups = getUserGroups(user);
    const perms = meta.permissions; // ex: "drwxr-xr-x"

    // 4. Verificare pentru OWNER
    if (meta.owner === user) {
        if (action === 'read' && perms[1] === 'r') return true;
        if (action === 'write' && perms[2] === 'w') return true;
        if (action === 'execute' && perms[3] === 'x') return true;
    }

    // 5. Verificare pentru GROUP
    if (userGroups.includes(meta.group)) {
        if (action === 'read' && perms[4] === 'r') return true;
        if (action === 'write' && perms[5] === 'w') return true;
        if (action === 'execute' && perms[6] === 'x') return true;
    }
    
    // 6. Verificare pentru OTHERS
    if (action === 'read' && perms[7] === 'r') return true;
    if (action === 'write' && perms[8] === 'w') return true;
    if (action === 'execute' && perms[9] === 'x') return true;

    return false;
}

// --- ENDPOINTS ---

router.get('/readdir', async (req, res) => {
    const { path: targetPath = '/', long: longFormat = 'false', user = DEFAULT_USER } = req.query;
    try {
        if (!(await checkPermission(targetPath, user, 'read'))) {
            return res.status(403).json({ error: `ls: cannot open directory '${targetPath}': Permission denied` });
        }
        const fullPath = getFullPath(targetPath);
        const entries = await fs.readdir(fullPath, { withFileTypes: true });
        const fileList = await Promise.all(
            entries.filter(e => !e.name.startsWith('.')).map(async entry => {
                const entryInfo = { name: entry.name, type: entry.isDirectory() ? 'dir' : 'file' };
                if (longFormat === 'true') {
                    const entryFullPath = path.join(fullPath, entry.name);
                    const stats = await fs.stat(entryFullPath);
                    const meta = await getMeta(entryFullPath);
                    const typePrefix = entry.isDirectory() ? 'd' : '-';
                    entryInfo.permissions = typePrefix + (meta?.permissions?.substring(1) || 'r--r--r--');
                    entryInfo.owner = meta?.owner || 'unknown';
                    entryInfo.group = meta?.group || 'unknown';
                    entryInfo.size = stats.size;
                    entryInfo.mtime = stats.mtime;
                }
                return entryInfo;
            })
        );
        res.json(fileList);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/stat', async (req, res) => {
    const { path: targetPath, user = DEFAULT_USER } = req.query;
    try {
        if (!(await checkPermission(targetPath, user, 'read'))) {
            return res.status(403).json({ error: `stat: cannot stat '${targetPath}': Permission denied` });
        }
        const fullPath = getFullPath(targetPath);
        const stats = await fs.stat(fullPath);
        res.json({ type: stats.isDirectory() ? 'directory' : 'file', size: stats.size, mtime: stats.mtime, ctime: stats.ctime });
    } catch (err) {
        if (err.code === 'ENOENT') return res.status(404).json({ error: 'No such file or directory' });
        res.status(500).json({ error: err.message });
    }
});

router.get('/read', async (req, res) => {
    const { path: targetPath, user = DEFAULT_USER } = req.query;
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

router.post('/write', async (req, res) => {
    const { path: filePath, content, append, user = DEFAULT_USER } = req.body;
    try {
        if (typeof filePath !== 'string' || content === undefined) {
            return res.status(400).json({ error: 'Path and content are required.' });
        }
        const dirOfFile = path.dirname(filePath);
        if (!(await checkPermission(dirOfFile, user, 'write'))) {
            return res.status(403).json({ error: `write: cannot create file in '${dirOfFile}': Permission denied` });
        }
        const fullPath = getFullPath(filePath);
        const metaPath = path.join(path.dirname(fullPath), `.${path.basename(fullPath)}.meta`);
        await fs.writeFile(fullPath, content, { encoding: 'utf8', flag: append ? 'a' : 'w' });
        try { await fs.access(metaPath); } catch {
            const defaultMeta = { owner: user, group: getUserGroups(user)[0] || 'users', permissions: '-rw-rw-r--' };
            await fs.writeFile(metaPath, JSON.stringify(defaultMeta, null, 2));
        }
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'EISDIR') return res.status(400).json({ error: `write: cannot write to '${filePath}': It is a directory` });
        res.status(500).json({ error: err.message });
    }
});

router.post('/mkdir', async (req, res) => {
    const { path: dirPath, user = DEFAULT_USER } = req.body;
    try {
        if (!dirPath) return res.status(400).json({ error: 'Path is required' });
        const parentDir = path.dirname(dirPath);
        if (!(await checkPermission(parentDir, user, 'write'))) {
            return res.status(403).json({ error: `mkdir: cannot create directory in '${parentDir}': Permission denied` });
        }
        const fullPath = getFullPath(dirPath);
        const metaPath = path.join(path.dirname(fullPath), `.${path.basename(fullPath)}.meta`);
        await fs.mkdir(fullPath, { recursive: true });
        const defaultMeta = { owner: user, group: getUserGroups(user)[0] || 'users', permissions: 'drwxrwxr-x' };
        await fs.writeFile(metaPath, JSON.stringify(defaultMeta, null, 2));
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'EEXIST') return res.status(409).json({ error: `mkdir: cannot create directory ‘${dirPath}’: File exists` });
        res.status(500).json({ error: err.message });
    }
});

router.delete('/rm', async (req, res) => {
    const { path: targetPath, recursive, user = DEFAULT_USER } = req.body;
    try {
        if (!targetPath) return res.status(400).json({ error: 'Path is required' });
        const parentDir = path.dirname(targetPath);
        if (!(await checkPermission(parentDir, user, 'write'))) {
            return res.status(403).json({ error: `rm: cannot remove items in '${parentDir}': Permission denied` });
        }
        if (!(await checkPermission(targetPath, user, 'write'))) {
             return res.status(403).json({ error: `rm: cannot remove '${targetPath}': Permission denied` });
        }
        const fullPath = getFullPath(targetPath);
        await fs.rm(fullPath, { recursive: !!recursive });
        const metaPath = path.join(path.dirname(fullPath), `.${path.basename(fullPath)}.meta`);
        try { await fs.rm(metaPath); } catch (e) { if (e.code !== 'ENOENT') console.warn(e); }
        res.json({ success: true });
    } catch (err) {
        if (err.code === 'ENOENT') return res.status(404).json({ error: `rm: cannot remove '${targetPath}': No such file or directory` });
        if (err.code === 'EISDIR' && !recursive) return res.status(400).json({ error: `rm: cannot remove '${targetPath}': Is a directory` });
        res.status(500).json({ error: err.message });
    }
});

router.post('/copy', async (req, res) => {
    const { source, destination, recursive, user = DEFAULT_USER } = req.body;
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
      const destMetaPath = path.join(path.dirname(destinationPath), `.${path.basename(destinationPath)}.meta`);
      const sourceStats = await fs.stat(sourcePath);
      const newMeta = { owner: user, group: getUserGroups(user)[0] || 'users', permissions: sourceStats.isDirectory() ? 'drwxrwxr-x' : '-rw-rw-r--' };
      await fs.writeFile(destMetaPath, JSON.stringify(newMeta, null, 2));
      res.json({ success: true });
    } catch (err) {
      if (err.code === 'ERR_FS_CP_DIR_TO_NON_DIR' || (err.code === 'EISDIR' && !recursive)) {
        return res.status(400).json({ error: `cp: -r not specified; omitting directory '${source}'` });
      }
      res.status(500).json({ error: err.message });
    }
});
  
router.post('/move', async (req, res) => {
    const { source, destination, user = DEFAULT_USER } = req.body;
    try {
      if (!source || !destination) return res.status(400).json({ error: 'Source and destination are required' });
      const sourceParent = path.dirname(source);
      const destParent = path.dirname(destination);
      if (!(await checkPermission(source, user, 'write'))) {
        return res.status(403).json({ error: `mv: cannot move '${source}': Permission denied` });
      }
      if (!(await checkPermission(sourceParent, user, 'write'))) {
        return res.status(403).json({ error: `mv: cannot move from '${sourceParent}': Permission denied` });
      }
      if (!(await checkPermission(destParent, user, 'write'))) {
        return res.status(403).json({ error: `mv: cannot move to '${destParent}': Permission denied` });
      }
      const sourcePath = getFullPath(source);
      let destinationPath = getFullPath(destination);
      const sourceMetaPath = path.join(path.dirname(sourcePath), `.${path.basename(sourcePath)}.meta`);
      try {
        const destStats = await fs.stat(destinationPath);
        if (destStats.isDirectory()) {
          destinationPath = path.join(destinationPath, path.basename(sourcePath));
        }
      } catch {}
      const destMetaPath = path.join(path.dirname(destinationPath), `.${path.basename(destinationPath)}.meta`);
      await fs.rename(sourcePath, destinationPath);
      try { await fs.rename(sourceMetaPath, destMetaPath); } catch (e) { if (e.code !== 'ENOENT') console.warn(e); }
      res.json({ success: true });
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: `mv: cannot stat '${source}': No such file or directory` });
      res.status(500).json({ error: err.message });
    }
});

router.post('/grep', async (req, res) => {
    const { path: targetPath, pattern, user = DEFAULT_USER } = req.body;
    try {
      if (!targetPath || pattern === undefined) return res.status(400).json({ error: 'Path and pattern are required' });
      if (!(await checkPermission(targetPath, user, 'read'))) {
        return res.status(403).json({ error: `grep: ${targetPath}: Permission denied` });
      }
      const fullPath = getFullPath(targetPath);
      const content = await fs.readFile(fullPath, 'utf8');
      const matchingLines = content.split(/\r?\n/).filter(line => line.includes(pattern));
      res.json(matchingLines);
    } catch (err) {
      if (err.code === 'ENOENT') return res.status(404).json({ error: `grep: ${targetPath}: No such file or directory` });
      if (err.code === 'EISDIR') return res.status(400).json({ error: `grep: ${targetPath}: Is a directory` });
      res.status(500).json({ error: err.message });
    }
});

router.post('/chmod', async (req, res) => {
    const { path: targetPath, mode, user = DEFAULT_USER } = req.body;
    try {
        if (!targetPath || !mode) return res.status(400).json({ error: 'Path and mode are required' });
        const fullPath = getFullPath(targetPath);
        const metaPath = path.join(path.dirname(fullPath), `.${path.basename(fullPath)}.meta`);
        let meta = await getMeta(fullPath);
        if (!meta) {
            return res.status(404).json({ error: `chmod: cannot access '${targetPath}': No such file or directory` });
        }
        if (meta.owner !== user && user !== 'root') {
            return res.status(403).json({ error: `chmod: changing permissions of '${targetPath}': Operation not permitted` });
        }
        if (!/^[0-7]{3}$/.test(mode)) {
            return res.status(400).json({ error: `chmod: invalid mode: ‘${mode}’` });
        }
        const typePrefix = meta.permissions.startsWith('d') ? 'd' : '-';
        const permissions = mode.split('').map(d => `${(parseInt(d,8)&4)?'r':'-'}${(parseInt(d,8)&2)?'w':'-'}${(parseInt(d,8)&1)?'x':'-'}`).join('');
        meta.permissions = typePrefix + permissions;
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;