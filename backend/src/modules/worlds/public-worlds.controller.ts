import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/index.js';
import { getWorld, listWorlds } from './worlds.service.js';
import { BadRequestError } from '../../common/errors.js';

/**
 * 用户端 - 列出所有可用世界书
 * POST /api/worlds/list
 * 返回轻量信息供用户选择绑定到角色
 */
export async function publicListWorlds(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const config = getConfig();
        const worlds = listWorlds(config.dataRoot);
        res.json(worlds);
    } catch (err) {
        next(err);
    }
}

/**
 * 用户端 - 读取世界书内容
 * POST /api/worlds/get
 * 返回可直接注入角色聊天上下文的 promptText
 */
export async function publicGetWorld(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { name, file_id: fileId } = req.body as { name?: string; file_id?: string };
        const worldId = String(name || fileId || '').trim();
        if (!worldId) throw new BadRequestError('name is required');

        const config = getConfig();
        const world = getWorld(config.dataRoot, worldId);
        if (!world) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'World not found' });
            return;
        }

        const entries = Object.values(world.entries || {})
            .filter((entry) => !entry.disable && entry.content)
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
        const promptText = entries
            .map((entry) => {
                const label = entry.comment || entry.key?.join(', ') || 'World Entry';
                return `### ${label}\n${entry.content}`;
            })
            .join('\n\n');

        res.json({
            file_id: worldId,
            name: world.name || worldId,
            entriesCount: entries.length,
            promptText,
        });
    } catch (err) {
        next(err);
    }
}
