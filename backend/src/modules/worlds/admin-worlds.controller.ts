import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import multer from 'multer';
import { getConfig } from '../../config/index.js';
import { listWorlds, getWorld, saveWorld, deleteWorld, getWorldsDir, sanitizeWorldName } from './worlds.service.js';
import { WorldInfo } from './worlds.types.js';

// multer 配置：惰性初始化，避免模块加载时 getConfig() 尚未就绪
let uploadInstance: multer.Multer | undefined;
function getUpload(): multer.Multer {
    if (!uploadInstance) {
        uploadInstance = multer({ storage: multer.memoryStorage() });
    }
    return uploadInstance;
}

/**
 * 管理员 - 列出所有世界书
 * POST /api/worlds/admin-list
 */
export async function adminListWorlds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const config = getConfig();
        const worlds = listWorlds(config.dataRoot);
        res.json(worlds);
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 获取指定世界书内容
 * POST /api/worlds/admin-get
 */
export async function adminGetWorld(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { name } = req.body as { name?: string };

        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'BAD_REQUEST', message: '缺少必填字段: name' });
            return;
        }

        const config = getConfig();
        const world = getWorld(config.dataRoot, name);

        if (!world) {
            res.status(404).json({ error: 'NOT_FOUND', message: `世界书 "${name}" 不存在` });
            return;
        }

        res.json(world);
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 创建或保存世界书
 * POST /api/worlds/admin-save
 */
export async function adminSaveWorld(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { name, data } = req.body as { name?: string; data?: WorldInfo };

        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'BAD_REQUEST', message: '缺少必填字段: name' });
            return;
        }

        if (!data || typeof data !== 'object' || !('entries' in data)) {
            res.status(400).json({ error: 'BAD_REQUEST', message: '数据必须包含 entries 字段' });
            return;
        }

        const config = getConfig();
        saveWorld(config.dataRoot, name, data);

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 删除世界书
 * POST /api/worlds/admin-delete
 */
export async function adminDeleteWorld(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { name } = req.body as { name?: string };

        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'BAD_REQUEST', message: '缺少必填字段: name' });
            return;
        }

        const config = getConfig();
        const deleted = deleteWorld(config.dataRoot, name);

        if (!deleted) {
            res.status(404).json({ error: 'NOT_FOUND', message: `世界书 "${name}" 不存在` });
            return;
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 导入世界书（上传 .json 文件）
 * POST /api/worlds/admin-import
 * multipart/form-data，文件字段名: file
 */
export async function adminImportWorld(req: Request, res: Response, next: NextFunction): Promise<void> {
    getUpload().single('file')(req, res, async (err: any) => {
        try {
            if (err) {
                res.status(400).json({ error: 'BAD_REQUEST', message: '文件上传失败' });
                return;
            }

            if (!req.file) {
                res.status(400).json({ error: 'BAD_REQUEST', message: '请选择要上传的 .json 文件' });
                return;
            }

            // 从内存中读取文件内容（memoryStorage）
            let worldData: WorldInfo;
            try {
                worldData = JSON.parse(req.file.buffer.toString('utf-8'));
            } catch {
                res.status(400).json({ error: 'BAD_REQUEST', message: '文件不是有效的 JSON 格式' });
                return;
            }

            if (!worldData || typeof worldData !== 'object' || !('entries' in worldData)) {
                res.status(400).json({ error: 'BAD_REQUEST', message: '世界书文件必须包含 entries 字段' });
                return;
            }

            let worldName = worldData.name;
            if (!worldName || typeof worldName !== 'string') {
                worldName = path.parse(req.file.originalname).name;
            }

            if (!worldName.trim()) {
                res.status(400).json({ error: 'BAD_REQUEST', message: '世界书名称不能为空' });
                return;
            }

            const config = getConfig();
            const existing = getWorld(config.dataRoot, worldName);
            if (existing) {
                res.status(409).json({ error: 'CONFLICT', message: `世界书 "${worldName}" 已存在，请使用其他名称或先删除旧文件` });
                return;
            }

            saveWorld(config.dataRoot, worldName, worldData);
            res.json({ ok: true, name: worldName });
        } catch (e) {
            next(e);
        }
    });
}
