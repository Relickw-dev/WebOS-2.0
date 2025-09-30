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
            vfsClient.writeFile(params.path, params.content, params.append).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.mkdir', (params) => {
            vfsClient.mkdir(params.path).then(params.resolve).catch(params.reject);
        });

        logger.info('VFS Driver: Initialized.');
    }
};

export default vfs;