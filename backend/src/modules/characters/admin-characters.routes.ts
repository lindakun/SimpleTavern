import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import {
    adminGetAllCharacters,
    adminQueryCharacters,
    adminGetCharacter,
    adminDeleteCharacter,
    adminEditCharacter,
    adminDeletePublishedCharacter,
    adminImportUgirl,
    adminImportUgirlUpload,
    adminListUgirlPackages,
    adminSetPrivacy,
    adminImportPng,
} from './admin-characters.controller.js';
import { getConfig } from '../../config/index.js';

export function createAdminCharacterRoutes(): Router {
    const router = Router();
    const config = getConfig();
    const upload = multer({
        dest: path.join(config.dataRoot, 'uploads'),
        limits: { fileSize: 512 * 1024 * 1024 }, // 512MB，兼容 st-package zip
    });

    router.post('/admin-all', adminGetAllCharacters);
    router.post('/admin-query', adminQueryCharacters);
    router.post('/admin-get', adminGetCharacter);
    router.post('/admin-set-privacy', adminSetPrivacy);
    router.post('/admin-delete', adminDeleteCharacter);
    router.post('/admin-edit', adminEditCharacter);
    router.post('/admin-delete-published', adminDeletePublishedCharacter);
    router.post('/admin-list-ugirl-packages', adminListUgirlPackages);
    router.post('/admin-import-ugirl', adminImportUgirl);
    router.post('/admin-import-ugirl-upload', upload.single('file'), adminImportUgirlUpload);
    router.post('/admin-import-png', upload.single('file'), adminImportPng);

    return router;
}
