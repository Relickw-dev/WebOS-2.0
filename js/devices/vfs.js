// File: js/devices/vfs.js
import { eventBus } from '../eventBus.js';
import { logger } from '../utils/logger.js';
import { vfsClient } from '../vfs/client.js'; // Importă noul client

const vfs = {
    init: () => {
        // Fiecare listener a fost corectat pentru a pasa 'params.cwd' către vfsClient.
        
        eventBus.on('vfs.readDir', (params) => {
            vfsClient.readDir(params.path, params.cwd).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.stat', (params) => {
            vfsClient.stat(params.path, params.cwd).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.readFile', (params) => {
            vfsClient.readFile(params.path, params.cwd).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.writeFile', (params) => {
            console.log('vfs.js received vfs.writeFile event with params:', params);
            vfsClient.writeFile(params.path, params.content, params.append, params.cwd).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.mkdir', (params) => {
            vfsClient.mkdir(params.path, params.cwd).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.rm', (params) => {
            vfsClient.rm(params.path, params.recursive, params.cwd).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.copyFile', (params) => {
            vfsClient.copyFile(params.source, params.destination, params.recursive, params.cwd).then(params.resolve).catch(params.reject);
        });

        eventBus.on('vfs.move', (params) => {
            vfsClient.move(params.source, params.destination, params.cwd).then(params.resolve).catch(params.reject);
        });
        
        eventBus.on('vfs.grep', (params) => {
            vfsClient.grep(params.path, params.pattern, params.cwd).then(params.resolve).catch(params.reject);
        });

        logger.info('VFS Driver: Initialized.');
    }
};

export default vfs;