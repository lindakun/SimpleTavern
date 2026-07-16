import { Router } from 'express';
import { getAdminStats } from './admin.stats.controller.js';
import { listLlms, testLlm } from './admin.llm.controller.js';
import { deleteAdminReview } from './admin.reviews.controller.js';

/**
 * 管理端聚合路由（挂载在 /api/admin，需 requireAdmin）
 */
export function createAdminRoutes(): Router {
    const router = Router();

    router.get('/stats', getAdminStats);
    router.get('/llm', listLlms);
    router.post('/llm/test', testLlm);
    router.delete('/reviews', deleteAdminReview);

    return router;
}
