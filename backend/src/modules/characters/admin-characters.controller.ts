import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { getAllUsers, getUserDirectories } from '../users/users.repository.js';
import { getAllCharacters, removeCharacter, processCharacter, editCharacter } from './characters.service.js';
import { getSeedCharacters } from './seed.service.js';
import { getUserCharacters, deleteUserCharacter } from './characters.user.service.js';
import { importUgirlCharacters } from './characters.ugirl-importer.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../common/logger.js';

/**
 * 管理员 - 获取所有用户的所有角色
 * POST /api/characters/admin-all
 */
export async function adminGetAllCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const config = getConfig();
        const filterHandle = req.body?.handle as string | undefined;
        const users = await getAllUsers();
        const results: Record<string, unknown>[] = [];

        // 1. 种子角色
        if (!filterHandle) {
            for (const seed of getSeedCharacters()) {
                results.push({
                    ...seed,
                    _owner: '__seed__',
                    _fileName: '',
                    _source: 'seed',
                });
            }
        }

        // 2. 用户发布角色（node-persist 存储）
        for (const user of users) {
            const handle = user.handle;
            if (filterHandle && handle !== filterHandle) continue;
            const userChars = await getUserCharacters(handle);
            for (const uc of userChars) {
                results.push({
                    ...uc,
                    _owner: handle,
                    _fileName: '',
                    _source: 'published',
                });
            }
        }

        // 3. 文件角色（PNG 角色卡）
        for (const user of users) {
            const handle = user.handle;
            if (filterHandle && handle !== filterHandle) continue;

            const dirs = getUserDirectories(config.dataRoot, handle);
            const characters = getAllCharacters(dirs.characters, dirs.chats, true);

            for (const char of characters) {
                const fileName = (char as Record<string, unknown>).avatar as string || '';
                results.push({
                    ...char,
                    _owner: handle,
                    _fileName: fileName,
                    _source: 'file',
                });
            }
        }

        res.json(results);
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 删除指定用户的指定角色
 * POST /api/characters/admin-delete
 */
export async function adminDeleteCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, avatar_url } = req.body as { handle?: string; avatar_url?: string };

        if (!handle || !avatar_url) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing required fields: handle, avatar_url' });
            return;
        }

        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);
        const deleted = removeCharacter(avatar_url, dirs.characters);

        if (!deleted) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
            return;
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 编辑指定用户的指定角色
 * POST /api/characters/admin-edit
 */
export async function adminEditCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, avatar_url, name, tags } = req.body as {
            handle?: string; avatar_url?: string;
            name?: string; tags?: string[];
        };

        if (!handle || !avatar_url) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing required fields: handle, avatar_url' });
            return;
        }

        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);

        // 读取完整角色数据
        const fullChar = processCharacter(avatar_url, dirs.characters, dirs.chats, false);
        if (!fullChar) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
            return;
        }

        // 更新字段（Record<string, unknown> 类型字段用索引访问）
        if (name !== undefined) {
            fullChar['name'] = name;
            const data = fullChar['data'] as Record<string, unknown> | undefined;
            if (data) data['name'] = name;
        }
        if (tags !== undefined) {
            fullChar['tags'] = tags;
            const data = fullChar['data'] as Record<string, unknown> | undefined;
            if (data) data['tags'] = tags;
        }

        editCharacter(avatar_url, dirs.characters, fullChar);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 批量导入 ugirl 角色
 * POST /api/characters/admin-import-ugirl
 * 接收: { file_path: 服务器上的 JSON 文件路径, handle: 目标用户名 }
 * 头像目录基于 JSON 文件所在目录自动解析（avatars_processed 子目录）
 */
export async function adminImportUgirl(req: Request, res: Response, next: NextFunction): Promise<void> {
    const config = getConfig();

    try {
        const { file_path, handle: handleRaw } = req.body as { file_path?: string; handle?: string };

        if (!file_path || typeof file_path !== 'string') {
            res.status(400).json({ code: 'BAD_REQUEST', message: '请提供服务器上的 JSON 文件路径 (file_path)' });
            return;
        }

        if (!fs.existsSync(file_path)) {
            res.status(400).json({ code: 'BAD_REQUEST', message: `文件不存在: ${file_path}` });
            return;
        }

        const handle = String(handleRaw || 'admin');

        // 验证目标用户存在
        const users = await getAllUsers();
        const targetUser = users.find(u => u.handle === handle);
        if (!targetUser) {
            res.status(400).json({ code: 'BAD_REQUEST', message: `目标用户 "${handle}" 不存在` });
            return;
        }

        const dirs = getUserDirectories(config.dataRoot, handle);

        // 确保 characters 目录存在
        if (!fs.existsSync(dirs.characters)) {
            fs.mkdirSync(dirs.characters, { recursive: true });
        }

        logger.info(`管理员导入 ugirl 角色: handle=${handle}, file_path=${file_path}`);

        const result = await importUgirlCharacters(
            file_path,
            dirs.characters,
        );

        res.json(result);
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 删除指定用户的发布角色
 * POST /api/characters/admin-delete-published
 */
export async function adminDeletePublishedCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, characterId } = req.body as { handle?: string; characterId?: string };

        if (!handle || !characterId) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing required fields: handle, characterId' });
            return;
        }

        const deleted = await deleteUserCharacter(handle, characterId);
        if (!deleted) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Published character not found' });
            return;
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}
