import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import multer from 'multer';
import { MulterError } from 'multer';
import { getConfig } from '../../config/index.js';
import { listWorlds, getWorld, saveWorld, deleteWorld, getWorldsDir, sanitizeWorldName } from './worlds.service.js';
import { WorldInfo } from './types.js';

// multer 配置：惰性初始化，避免模块加载时 getConfig() 尚未就绪
let uploadInstance: multer.Multer | undefined;
function getUpload(): multer.Multer {
    if (!uploadInstance) {
        uploadInstance = multer({
            storage: multer.memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
            fileFilter: (_req, file, cb) => {
                if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
                    cb(null, true);
                } else {
                    cb(new Error('只支持 .json 文件'));
                }
            },
        });
    }
    return uploadInstance;
}

/**
 * 将 entries 数组格式转换为 SillyTavern 内部的 Record<string, WorldInfoEntry> 格式
 * 兼容 V2/V3 角色卡导出格式（entries 为数组）和 SillyTavern 内部格式（entries 为对象）
 */
function normalizeEntries(worldData: any): WorldInfo {
    if (Array.isArray(worldData.entries)) {
        const entries: Record<string, any> = {};
        for (let i = 0; i < worldData.entries.length; i++) {
            const entry = worldData.entries[i];
            const uid = entry.uid ?? i;
            // 映射 V2/V3 字段名到 SillyTavern 内部字段名
            entries[String(uid)] = {
                uid,
                key: entry.keys ?? entry.key ?? [],
                keysecondary: entry.secondaryKeys ?? entry.keysecondary ?? [],
                content: entry.content ?? '',
                comment: entry.comment ?? '',
                constant: entry.constant ?? false,
                selective: entry.selective ?? false,
                order: entry.insertionOrder ?? entry.order ?? 100,
                position: entry.position ?? 0,
                disable: !(entry.enabled ?? true),
                depth: entry.depth ?? 4,
                probability: entry.probability ?? 100,
                useProbability: entry.useProbability ?? true,
                vectorized: entry.vectorized ?? false,
                selectiveLogic: entry.selectiveLogic ?? 0,
                addMemo: entry.addMemo ?? false,
                ignoreBudget: entry.ignoreBudget ?? false,
                excludeRecursion: entry.excludeRecursion ?? false,
                preventRecursion: entry.preventRecursion ?? false,
                delayUntilRecursion: entry.delayUntilRecursion ?? 0,
                group: entry.group ?? '',
                groupOverride: entry.groupOverride ?? false,
                groupWeight: entry.groupWeight ?? 100,
                scanDepth: entry.scanDepth ?? null,
                caseSensitive: entry.caseSensitive ?? null,
                matchWholeWords: entry.matchWholeWords ?? null,
                useGroupScoring: entry.useGroupScoring ?? null,
                automationId: entry.automationId ?? '',
                role: entry.role ?? 0,
                sticky: entry.sticky ?? null,
                cooldown: entry.cooldown ?? null,
                delay: entry.delay ?? null,
                outletName: entry.outletName ?? '',
            };
        }
        return {
            ...worldData,
            entries,
        };
    }
    return worldData;
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
            res.status(400).json({ code: 'BAD_REQUEST', message: '缺少必填字段: name' });
            return;
        }

        const config = getConfig();
        const world = getWorld(config.dataRoot, name);

        if (!world) {
            res.status(404).json({ code: 'NOT_FOUND', message: `世界书 "${name}" 不存在` });
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
            res.status(400).json({ code: 'BAD_REQUEST', message: '缺少必填字段: name' });
            return;
        }

        if (!data || typeof data !== 'object' || !('entries' in data)) {
            res.status(400).json({ code: 'BAD_REQUEST', message: '数据必须包含 entries 字段' });
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
            res.status(400).json({ code: 'BAD_REQUEST', message: '缺少必填字段: name' });
            return;
        }

        const config = getConfig();
        const deleted = deleteWorld(config.dataRoot, name);

        if (!deleted) {
            res.status(404).json({ code: 'NOT_FOUND', message: `世界书 "${name}" 不存在` });
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
    getUpload().single('file')(req, res, async (err: unknown) => {
        try {
            if (err instanceof MulterError) {
                // multer 特定错误
                if (err.code === 'LIMIT_FILE_SIZE') {
                    res.status(400).json({ code: 'FILE_TOO_LARGE', message: '文件大小超过限制（最大 10MB）' });
                } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                    res.status(400).json({ code: 'UNEXPECTED_FIELD', message: '意外的文件字段名，请使用 "file"' });
                } else {
                    res.status(400).json({ code: 'UPLOAD_FAILED', message: `文件上传失败: ${err.message}` });
                }
                return;
            }
            if (err) {
                // 其他未知错误
                res.status(500).json({ code: 'INTERNAL_ERROR', message: '文件上传时发生未知错误' });
                return;
            }

            if (!req.file) {
                res.status(400).json({ code: 'BAD_REQUEST', message: '请选择要上传的 .json 文件' });
                return;
            }

            // 从内存中读取文件内容（memoryStorage）
            let worldData: WorldInfo;
            try {
                const raw = JSON.parse(req.file.buffer.toString('utf-8'));
                worldData = normalizeEntries(raw);
            } catch {
                res.status(400).json({ code: 'BAD_REQUEST', message: '文件不是有效的 JSON 格式' });
                return;
            }

            if (!worldData || typeof worldData !== 'object' || !('entries' in worldData)) {
                res.status(400).json({ code: 'BAD_REQUEST', message: '世界书文件必须包含 entries 字段' });
                return;
            }

            let worldName = worldData.name;
            if (!worldName || typeof worldName !== 'string') {
                worldName = path.parse(req.file.originalname).name;
            }

            if (!worldName.trim()) {
                res.status(400).json({ code: 'BAD_REQUEST', message: '世界书名称不能为空' });
                return;
            }

            const config = getConfig();
            const existing = getWorld(config.dataRoot, worldName);
            if (existing) {
                res.status(409).json({ code: 'CONFLICT', message: `世界书 "${worldName}" 已存在，请使用其他名称或先删除旧文件` });
                return;
            }

            saveWorld(config.dataRoot, worldName, worldData);
            res.json({ ok: true, name: worldName });
        } catch (e) {
            next(e);
        }
    });
}
