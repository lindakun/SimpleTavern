import { Router } from 'express';
import * as chatController from './chat-completions.controller.js';

/**
 * 注册聊天补全路由
 */
export function createChatRoutes(): Router {
    const router = Router();

    // 通用聊天接口 — 前端聊天入口
    router.post('/chat', chatController.chat);
    // 流式聊天接口 — SSE 逐 token 推送
    router.post('/chat/stream', chatController.chatStream);
    // 仅构建 prompt（调试上下文质量，不调用 LLM）
    router.post('/chat/debug-prompt', chatController.debugPrompt);
    router.get('/chat/providers', chatController.getProviders);

    return router;
}
