// File: js/devices/vfs.js (Versiune corectată)
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { vfsClient } from '../vfs/client.js'; // Importă clientul

const vfs = {
    init: () => {
        // Fiecare listener a fost corectat pentru a pasa 'params.user' către vfsClient.
        
        eventBus.on('vfs.readDir', (params) => {
            vfsClient.readDir(params.path, params.user, params.long).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.stat', (params) => {
            vfsClient.stat(params.path, params.user).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.readFile', (params) => {
            vfsClient.readFile(params.path, params.user).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.writeFile', (params) => {
            vfsClient.writeFile(params.path, params.content, params.append, params.user).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.mkdir', (params) => {
            vfsClient.mkdir(params.path, params.user).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.rm', (params) => {
            vfsClient.rm(params.path, params.recursive, params.user).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.copyFile', (params) => {
            vfsClient.copyFile(params.source, params.destination, params.recursive, params.user).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.move', (params) => {
            vfsClient.move(params.source, params.destination, params.user).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.grep', (params) => {
            vfsClient.grep(params.path, params.pattern, params.user).then(params.resolve).catch(params.reject);
        });
        
        // Adăugăm și chmod, care lipsea
        eventBus.on('vfs.chmod', (params) => {
            vfsClient.chmod(params.path, params.mode, params.user).then(params.resolve).catch(params.reject);
        });

        logger.info('VFS Driver: Initialized.');
    }
};

export default vfs;