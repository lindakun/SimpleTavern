import { Router } from 'express';
import {
    adminGetAllCharacters,
    adminGetCharacter,
    adminDeleteCharacter,
    adminEditCharacter,
    adminDeletePublishedCharacter,
    adminImportUgirl,
    adminSetPrivacy,
} from './admin-characters.controller.js';

export function createAdminCharacterRoutes(): Router {
    const router = Router();

    router.post('/admin-all', adminGetAllCharacters);
    router.post('/admin-get', adminGetCharacter);
    router.post('/admin-set-privacy', adminSetPrivacy);
    router.post('/admin-delete', adminDeleteCharacter);
    router.post('/admin-edit', adminEditCharacter);
    router.post('/admin-delete-published', adminDeletePublishedCharacter);
    router.post('/admin-import-ugirl', adminImportUgirl);

    return router;
}
