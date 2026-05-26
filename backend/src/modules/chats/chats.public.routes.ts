import { Router } from 'express';
import * as chatController from './chats.controller.js';

export function createPublicChatRoutes(): Router {
    const router = Router();

    router.get('/chat/threads', chatController.getChatThreads);
    router.get('/chat/threads/:characterId', chatController.getThreadHistory);

    return router;
}
