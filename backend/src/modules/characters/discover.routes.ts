import { Router } from 'express';
import * as discoverController from './discover.controller.js';

/**
 * 注册发现/探索路由（公开，无需登录）
 */
export function createDiscoverRoutes(): Router {
    const router = Router();

    router.get('/discover', discoverController.getDiscoverCharacters);
    router.get('/discover/:id', discoverController.getDiscoverCharacter);
    router.post('/discover/:id/reviews', discoverController.addReview);

    return router;
}
