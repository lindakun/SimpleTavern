import { Request, Response, NextFunction } from 'express';
import { getConfig } from '../../config/index.js';
import { listWorlds } from './worlds.service.js';

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
