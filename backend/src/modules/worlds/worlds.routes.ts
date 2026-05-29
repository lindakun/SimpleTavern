import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import {
    adminListWorlds,
    adminGetWorld,
    adminSaveWorld,
    adminDeleteWorld,
    adminImportWorld,
} from './admin-worlds.controller.js';
import { publicListWorlds } from './public-worlds.controller.js';

/**
 * 管理员世界书路由（需 requireAdmin 守卫）
 */
export function createAdminWorldRoutes(): Router {
    const router = Router();

    router.post('/admin-list', adminListWorlds);
    router.post('/admin-get', adminGetWorld);
    router.post('/admin-save', adminSaveWorld);
    router.post('/admin-delete', adminDeleteWorld);

    // 文件上传导入（multer 单文件字段名为 "file"）
    const upload = multer({
        dest: path.join('/tmp', 'world-uploads'),
        limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
        fileFilter: (_req, file, cb) => {
            if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
                cb(null, true);
            } else {
                cb(new Error('只支持 .json 文件'));
            }
        },
    });
    router.post('/admin-import', upload.single('file'), adminImportWorld);

    return router;
}

/**
 * 公开世界书路由（需 requireLogin 守卫，用户端使用）
 */
export function createPublicWorldRoutes(): Router {
    const router = Router();

    // 用户可用的世界书列表（仅返回名称和基本信息）
    router.post('/list', publicListWorlds);

    return router;
}
