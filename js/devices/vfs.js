// File: js/devices/vfs.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { vfsClient } from '../vfs/client.js'; // Importă noul client

const vfs = {
    init: () => {
        eventBus.on('vfs.readDir', (params) => {
            vfsClient.readDir(params.path).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.stat', (params) => {
            vfsClient.stat(params.path).then(params.resolve).catch(params.reject);
        });
        
        // Adaugă handlere pentru celelalte operațiuni
        eventBus.on('vfs.readFile', (params) => {
            vfsClient.readFile(params.path).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.writeFile', (params) => {
            // --- PUNCT DE DEPANARE FINAL ---
            // Acest log este cel mai important. Ar trebui să vedem 'content' aici.
            console.log('vfs.js received vfs.writeFile event with params:', params);

            vfsClient.writeFile(params.path, params.content, params.append).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.mkdir', (params) => {
            vfsClient.mkdir(params.path).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.rm', (params) => {
            vfsClient.rm(params.path, params.recursive).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.copyFile', (params) => {
            vfsClient.copyFile(params.source, params.destination, params.recursive).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.move', (params) => {
            vfsClient.move(params.source, params.destination).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.grep', (params) => {
            vfsClient.grep(params.path, params.pattern).then(params.resolve).catch(params.reject);
        });

        logger.info('VFS Driver: Initialized.');
    }
};

export default vfs;