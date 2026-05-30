import { Router } from 'express';
import {
    adminListWorlds,
    adminGetWorld,
    adminSaveWorld,
    adminDeleteWorld,
    adminImportWorld,
} from './admin-worlds.controller.js';
import { publicGetWorld, publicListWorlds } from './public-worlds.controller.js';

/**
 * 管理员世界书路由（需 requireAdmin 守卫）
 */
export function createAdminWorldRoutes(): Router {
    const router = Router();

    router.post('/admin-list', adminListWorlds);
    router.post('/admin-get', adminGetWorld);
    router.post('/admin-save', adminSaveWorld);
    router.post('/admin-delete', adminDeleteWorld);

    // 文件上传导入：multer 在 controller 内部处理（memoryStorage）
    router.post('/admin-import', adminImportWorld);

    return router;
}

/**
 * 公开世界书路由（需 requireLogin 守卫，用户端使用）
 */
export function createPublicWorldRoutes(): Router {
    const router = Router();

    // 用户可用的世界书列表（仅返回名称和基本信息）
    router.post('/list', publicListWorlds);
    router.post('/get', publicGetWorld);

    return router;
}
