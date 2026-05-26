import { Router } from 'express';
import * as characterController from './characters.controller.js';
import { requireLogin } from '../../shared/middleware/auth-guard.js';

/**
 * 注册字符模块路由（所有路由需要登录）
 */
export function createCharacterRoutes(): Router {
    const router = Router();

    router.post('/all', characterController.getAllCharacters);
    router.post('/get', characterController.getCharacter);
    router.post('/create', characterController.createCharacter);
    router.post('/edit', characterController.editCharacter);
    router.post('/delete', characterController.deleteCharacter);
    router.post('/rename', characterController.renameCharacter);
    router.post('/duplicate', characterController.duplicateCharacter);
    router.post('/export', characterController.exportCharacter);
    router.post('/import', characterController.importCharacter);
    router.post('/chats', characterController.getCharacterChats);

    return router;
}
