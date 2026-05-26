import { Router } from 'express';
import * as chatController from './chat-completions.controller.js';

/**
 * 注册聊天补全路由
 */
export function createChatRoutes(): Router {
    const router = Router();

    // 通用聊天接口 — 前端聊天入口
    router.post('/chat', chatController.chat);
    router.get('/chat/providers', chatController.getProviders);

    return router;
}
