import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { getAllUsers, getUserDirectories } from '../users/users.repository.js';
import { getAllCharacters, removeCharacter, processCharacter, editCharacter } from './characters.service.js';
import { getSeedCharacters, getSeedCharacterById } from './seed.service.js';
import {
    getUserCharacters,
    getUserCharacter,
    deleteUserCharacter,
    updateUserCharacter,
    updateCharacterPrivacy,
} from './characters.user.service.js';
import { importUgirlCharacters } from './characters.ugirl-importer.js';
import {
    getSeedReviews,
    getImportedReviews,
    getPngReviews,
    type ReviewData,
} from './reviews.repository.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../common/logger.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { invalidateAdminStatsCache } from '../admin/admin.stats.controller.js';
import { invalidateDiscoverCache } from './discover.controller.js';
import { importCharacterFile } from './characters.importer.js';

export type AdminCharacterSource = 'seed' | 'published' | 'file';

export interface AdminReviewItem extends ReviewData {
    store: 'seed' | 'imported' | 'png' | 'published';
    characterKey: string;
}

function pickCharFields(char: Record<string, unknown>) {
    const data = (char.data as Record<string, unknown> | undefined) || {};
    return {
        name: String(char.name || data.name || ''),
        description: String(char.description || data.description || ''),
        personality: String(char.personality || data.personality || ''),
        scenario: String(char.scenario || data.scenario || ''),
        first_mes: String(char.first_mes || data.first_mes || ''),
        mes_example: String(char.mes_example || data.mes_example || ''),
        tags: Array.isArray(char.tags) ? char.tags : (Array.isArray(data.tags) ? data.tags : []),
        creator: String(char.creator || data.creator || ''),
        privacyType: (char.privacyType as string | undefined) || 'private',
        avatar: String(char.avatar || ''),
        system_prompt: String(char.system_prompt || data.system_prompt || ''),
        creator_notes: String(char.creator_notes || data.creator_notes || ''),
    };
}

/** 聚合全站角色（供 admin-all / admin-query 复用） */
async function collectAllCharacters(filterHandle?: string): Promise<Record<string, unknown>[]> {
    const config = getConfig();
    const users = await getAllUsers();
    const results: Record<string, unknown>[] = [];

    if (!filterHandle) {
        for (const seed of getSeedCharacters()) {
            results.push({
                ...seed,
                _owner: '__seed__',
                _fileName: '',
                _source: 'seed',
                privacyType: (seed as { privacyType?: string }).privacyType || 'public',
                reviewCount: Array.isArray(seed.reviews) ? seed.reviews.length : (seed.reviewCount || 0),
            });
        }
    }

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
                privacyType: uc.privacyType || 'private',
                reviewCount: Array.isArray(uc.reviews) ? uc.reviews.length : (uc.reviewCount || 0),
            });
        }
    }

    for (const user of users) {
        const handle = user.handle;
        if (filterHandle && handle !== filterHandle) continue;

        const dirs = getUserDirectories(config.dataRoot, handle);
        const characters = getAllCharacters(dirs.characters, dirs.chats, true);

        for (const char of characters) {
            const rec = char as Record<string, unknown>;
            const fileName = (rec.avatar as string) || '';
            results.push({
                ...char,
                _owner: handle,
                _fileName: fileName,
                _source: 'file',
                // file 不可上发现页，列表展示用
                privacyType: rec.privacyType || null,
                reviewCount: typeof rec.reviewCount === 'number' ? rec.reviewCount : 0,
            });
        }
    }

    return results;
}

/**
 * 管理员 - 获取所有用户的所有角色
 * POST /api/characters/admin-all
 */
export async function adminGetAllCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const filterHandle = req.body?.handle as string | undefined;
        res.json(await collectAllCharacters(filterHandle));
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 筛选分页查询
 * POST /api/characters/admin-query
 */
export async function adminQueryCharacters(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const {
            handle,
            source = 'all',
            privacy = 'all',
            tag,
            q,
            sort = 'name',
            order = 'asc',
            page = 1,
            pageSize = 50,
        } = req.body as {
            handle?: string;
            source?: 'seed' | 'published' | 'file' | 'all';
            privacy?: 'public' | 'private' | 'all';
            tag?: string;
            q?: string;
            sort?: 'name' | 'owner' | 'date' | 'size';
            order?: 'asc' | 'desc';
            page?: number;
            pageSize?: number;
        };

        const pageNum = Math.max(1, Number(page) || 1);
        const size = Math.min(200, Math.max(1, Number(pageSize) || 50));

        let items = await collectAllCharacters(handle);

        if (source && source !== 'all') {
            items = items.filter((c) => c._source === source);
        }

        if (privacy && privacy !== 'all') {
            items = items.filter((c) => {
                if (c._source === 'file') return false; // file 无上架隐私，不参与 public/private 筛选
                const p = (c.privacyType as string) || (c._source === 'seed' ? 'public' : 'private');
                return p === privacy;
            });
        }

        if (tag) {
            items = items.filter((c) => Array.isArray(c.tags) && (c.tags as string[]).includes(tag));
        }

        if (q && String(q).trim()) {
            const needle = String(q).trim().toLowerCase();
            items = items.filter((c) => String(c.name || '').toLowerCase().includes(needle));
        }

        const dir = order === 'desc' ? -1 : 1;
        items.sort((a, b) => {
            let av: string | number = 0;
            let bv: string | number = 0;
            switch (sort) {
                case 'owner':
                    av = String(a._owner || '');
                    bv = String(b._owner || '');
                    break;
                case 'date':
                    av = Number(a.date_added || a.created || 0);
                    bv = Number(b.date_added || b.created || 0);
                    break;
                case 'size':
                    av = Number(a.data_size || 0);
                    bv = Number(b.data_size || 0);
                    break;
                case 'name':
                default:
                    av = String(a.name || '').toLowerCase();
                    bv = String(b.name || '').toLowerCase();
                    break;
            }
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });

        const total = items.length;
        const start = (pageNum - 1) * size;
        const pageItems = items.slice(start, start + size);

        res.json({ items: pageItems, total, page: pageNum, pageSize: size });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 获取单个角色详情（含评价）
 * POST /api/characters/admin-get
 * body: { source, handle?, characterId?, avatar_url? }
 */
export async function adminGetCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { source, handle, characterId, avatar_url } = req.body as {
            source?: AdminCharacterSource;
            handle?: string;
            characterId?: string;
            avatar_url?: string;
        };

        if (!source) {
            throw new BadRequestError('Missing required field: source');
        }

        if (source === 'seed') {
            const id = characterId || '';
            const seed = getSeedCharacterById(id);
            if (!seed) throw new NotFoundError('Seed character');
            const reviews: AdminReviewItem[] = getSeedReviews(id).map((r) => ({
                ...r,
                store: 'seed' as const,
                characterKey: id,
            }));
            res.json({
                character: {
                    ...seed,
                    _owner: '__seed__',
                    _fileName: '',
                    _source: 'seed',
                    ...pickCharFields(seed as unknown as Record<string, unknown>),
                },
                reviews,
                readonly: true,
            });
            return;
        }

        if (source === 'published') {
            if (!handle || !characterId) {
                throw new BadRequestError('Missing required fields: handle, characterId');
            }
            const char = await getUserCharacter(handle, characterId);
            if (!char) throw new NotFoundError('Published character');
            const reviews: AdminReviewItem[] = (char.reviews || []).map((r) => ({
                ...r,
                store: 'published' as const,
                characterKey: `${handle}:${characterId}`,
            }));
            res.json({
                character: {
                    ...char,
                    _owner: handle,
                    _fileName: '',
                    _source: 'published',
                },
                reviews,
                readonly: false,
            });
            return;
        }

        // file
        if (!handle || !avatar_url) {
            throw new BadRequestError('Missing required fields: handle, avatar_url');
        }
        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);
        const fullChar = processCharacter(avatar_url, dirs.characters, dirs.chats, false);
        if (!fullChar) throw new NotFoundError('Character');

        const pngKey = `${handle}/characters/${avatar_url}`;
        let reviewList = getPngReviews(pngKey);
        let store: AdminReviewItem['store'] = 'png';
        let characterKey = pngKey;

        // default-user 导入角色可能写在 imported-reviews
        if (handle === 'default-user') {
            const imported = getImportedReviews(avatar_url);
            if (imported.length > 0) {
                reviewList = imported;
                store = 'imported';
                characterKey = avatar_url;
            }
        }

        const reviews: AdminReviewItem[] = reviewList.map((r) => ({
            ...r,
            store,
            characterKey,
        }));

        res.json({
            character: {
                ...fullChar,
                ...pickCharFields(fullChar as Record<string, unknown>),
                _owner: handle,
                _fileName: avatar_url,
                _source: 'file',
            },
            reviews,
            readonly: false,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 强制切换隐私（仅 published）
 * POST /api/characters/admin-set-privacy
 */
export async function adminSetPrivacy(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, characterId, privacyType, source } = req.body as {
            handle?: string;
            characterId?: string;
            privacyType?: 'public' | 'private';
            source?: string;
        };

        if (source === 'seed') {
            throw new BadRequestError('种子角色为只读，无法修改隐私');
        }
        if (!handle || !characterId || !privacyType) {
            throw new BadRequestError('Missing required fields: handle, characterId, privacyType');
        }
        if (privacyType !== 'public' && privacyType !== 'private') {
            throw new BadRequestError('privacyType must be "public" or "private"');
        }

        // 文件角色：暂无独立 privacy 字段时，仅支持 published
        if (source === 'file') {
            throw new BadRequestError('文件角色暂不支持隐私切换，请使用发布角色或删除');
        }

        const updated = await updateCharacterPrivacy(handle, characterId, privacyType);
        if (!updated) {
            throw new NotFoundError('Published character');
        }

        invalidateAdminStatsCache();
        invalidateDiscoverCache();
        res.json({ ok: true, character: updated });
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
        const { handle, avatar_url, source } = req.body as {
            handle?: string;
            avatar_url?: string;
            source?: string;
        };

        if (source === 'seed' || handle === '__seed__') {
            throw new BadRequestError('种子角色为只读，无法删除');
        }

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

        invalidateAdminStatsCache();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 编辑角色（file / published；seed 只读）
 * POST /api/characters/admin-edit
 */
function applyCharField(
    fullChar: Record<string, unknown>,
    key: string,
    value: unknown,
): void {
    fullChar[key] = value;
    const data = fullChar['data'] as Record<string, unknown> | undefined;
    if (data) data[key] = value;
}

export async function adminEditCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const {
            handle,
            avatar_url,
            characterId,
            source,
            name,
            tags,
            description,
            personality,
            scenario,
            first_mes,
            system_prompt,
        } = req.body as {
            handle?: string;
            avatar_url?: string;
            characterId?: string;
            source?: AdminCharacterSource;
            name?: string;
            tags?: string[];
            description?: string;
            personality?: string;
            scenario?: string;
            first_mes?: string;
            system_prompt?: string;
        };

        if (source === 'seed' || handle === '__seed__') {
            throw new BadRequestError('种子角色为只读，无法编辑');
        }

        // 发布角色
        if (source === 'published' || (!avatar_url && characterId)) {
            if (!handle || !characterId) {
                throw new BadRequestError('Missing required fields: handle, characterId');
            }
            const updated = await updateUserCharacter(handle, characterId, {
                ...(name !== undefined ? { name } : {}),
                ...(tags !== undefined ? { tags } : {}),
                ...(description !== undefined ? { description } : {}),
                ...(personality !== undefined ? { personality } : {}),
                ...(scenario !== undefined ? { scenario } : {}),
                ...(first_mes !== undefined ? { first_mes } : {}),
                ...(system_prompt !== undefined ? { system_prompt } : {}),
            });
            if (!updated) throw new NotFoundError('Published character');
            invalidateAdminStatsCache();
            invalidateDiscoverCache();
            res.json({ ok: true, character: updated });
            return;
        }

        if (!handle || !avatar_url) {
            res.status(400).json({ code: 'BAD_REQUEST', message: 'Missing required fields: handle, avatar_url' });
            return;
        }

        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);

        const fullChar = processCharacter(avatar_url, dirs.characters, dirs.chats, false);
        if (!fullChar) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
            return;
        }

        if (name !== undefined) applyCharField(fullChar as Record<string, unknown>, 'name', name);
        if (tags !== undefined) applyCharField(fullChar as Record<string, unknown>, 'tags', tags);
        if (description !== undefined) applyCharField(fullChar as Record<string, unknown>, 'description', description);
        if (personality !== undefined) applyCharField(fullChar as Record<string, unknown>, 'personality', personality);
        if (scenario !== undefined) applyCharField(fullChar as Record<string, unknown>, 'scenario', scenario);
        if (first_mes !== undefined) applyCharField(fullChar as Record<string, unknown>, 'first_mes', first_mes);
        if (system_prompt !== undefined) applyCharField(fullChar as Record<string, unknown>, 'system_prompt', system_prompt);

        editCharacter(avatar_url, dirs.characters, fullChar);
        invalidateAdminStatsCache();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 上传 PNG/JSON 角色卡到指定用户
 * POST /api/characters/admin-import-png  (multipart: file + handle)
 */
export async function adminImportPng(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const file = req.file;
        if (!file) throw new BadRequestError('No file uploaded');

        const handle = String(req.body?.handle || '').trim();
        if (!handle) {
            try { fs.unlinkSync(file.path); } catch { /* ignore */ }
            throw new BadRequestError('Missing required field: handle');
        }

        const users = await getAllUsers();
        if (!users.find((u) => u.handle === handle)) {
            try { fs.unlinkSync(file.path); } catch { /* ignore */ }
            throw new BadRequestError(`目标用户 "${handle}" 不存在`);
        }

        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);
        if (!fs.existsSync(dirs.characters)) {
            fs.mkdirSync(dirs.characters, { recursive: true });
        }

        const pngName = await importCharacterFile(file.path, file.originalname, dirs.characters);
        logger.info(`管理员导入角色到 ${handle}: ${pngName}`);
        invalidateAdminStatsCache();
        res.json({ ok: true, path: pngName, handle });
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

        invalidateAdminStatsCache();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * 管理员 - 删除发布角色上的评价（存于 node-persist）
 * 由 DELETE /api/admin/reviews 在 store=published 时调用亦可
 */
export async function deletePublishedReview(
    handle: string,
    characterId: string,
    reviewId: string,
): Promise<boolean> {
    const char = await getUserCharacter(handle, characterId);
    if (!char) return false;
    const reviews = (char.reviews || []).filter((r) => r.id !== reviewId);
    if (reviews.length === (char.reviews || []).length) return false;

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const rating = reviews.length > 0 ? parseFloat((totalRating / reviews.length).toFixed(1)) : 0;
    await updateUserCharacter(handle, characterId, {
        reviews,
        rating,
        reviewCount: reviews.length,
    });
    return true;
}
