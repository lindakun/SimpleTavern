import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import * as chatController from './chats.controller.js';
import { getConfig } from '../../config/index.js';

/**
 * 注册聊天模块路由（需登录）
 */
export function createChatRoutes(): Router {
    const router = Router();
    const config = getConfig();

    const upload = multer({ dest: path.join(config.dataRoot, 'uploads') });

    // 个人聊天
    router.post('/save', chatController.saveChat);
    router.post('/get', chatController.getChat);
    router.post('/rename', chatController.renameChat);
    router.post('/delete', chatController.deleteChat);
    router.post('/export', chatController.exportChat);
    router.post('/import', upload.single('chats'), chatController.importChat);

    // 群组聊天
    router.post('/group/get', chatController.getGroupChat);
    router.post('/group/save', chatController.saveGroupChat);
    router.post('/group/delete', chatController.deleteGroupChat);
    router.post('/group/import', upload.single('group_chat'), chatController.importGroupChat);

    // 批量操作
    router.post('/batch-delete', chatController.batchDeleteChats);
    router.post('/pin', chatController.togglePinChat);

    return router;
}
