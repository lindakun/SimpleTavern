import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as seedService from './seed.service.js';
import * as userCharacterService from './characters.user.service.js';
import { readCharacterCardFromFile } from './characters.parser.js';
import { getAllImportedReviews, addImportedReview } from './reviews.repository.js';
import { getAllPngReviews, addPngReview } from './reviews.repository.js';
import { BadRequestError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../common/logger.js';

/** 导入角色列表内存缓存（按目录 mtime 失效） */
let importedCache: { mtimeMs: number; data: any[] } | null = null;
const DISCOVER_CACHE_TTL_MS = 30_000;
let discoverListCache: { expiresAt: number; data: any[] } | null = null;

function getDirMtimeMs(dir: string): number {
    try {
        if (!fs.existsSync(dir)) return 0;
        let max = fs.statSync(dir).mtimeMs;
        for (const f of fs.readdirSync(dir)) {
            if (!f.endsWith('.png')) continue;
            try {
                const st = fs.statSync(path.join(dir, f));
                if (st.mtimeMs > max) max = st.mtimeMs;
            } catch { /* skip */ }
        }
        return max;
    } catch {
        return 0;
    }
}

/**
 * 扫描用户目录，获取导入的 PNG 角色卡
 * 附带持久化的评价数据；带 mtime 缓存
 */
function getImportedCharacters(): any[] {
    const config = getConfig();
    const charactersDir = path.join(config.dataRoot, 'default-user', 'characters');

    if (!fs.existsSync(charactersDir)) {
        importedCache = null;
        return [];
    }

    const mtimeMs = getDirMtimeMs(charactersDir);
    if (importedCache && importedCache.mtimeMs === mtimeMs) {
        return importedCache.data;
    }

    const result: any[] = [];
    const importedReviews = getAllImportedReviews();
    const files = fs.readdirSync(charactersDir).filter(f => f.endsWith('.png'));

    for (const file of files) {
        try {
            const filePath = path.join(charactersDir, file);
            const imgData = readCharacterCardFromFile(filePath);
            if (!imgData) continue;

            const jsonData = JSON.parse(imgData);
            const charData = jsonData.data || jsonData;
            const name = charData?.name || jsonData.name || path.parse(file).name;

            const reviews = importedReviews[file] || [];
            const totalRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
            const avgRating = reviews.length > 0
                ? parseFloat((totalRating / reviews.length).toFixed(1))
                : 0;

            const description = charData?.description || jsonData.description || '';
            const tagline = (charData?.creator_notes || description || '').slice(0, 80);

            result.push({
                id: `imported_${path.parse(file).name}`,
                name,
                avatar: `/api/characters/avatar/${encodeURIComponent(file)}`,
                creator: charData?.creator || 'Imported',
                rating: avgRating,
                reviewCount: reviews.length,
                tags: Array.isArray(charData?.tags) ? charData.tags : [],
                description,
                personality: charData?.personality || '',
                scenario: charData?.scenario || '',
                first_mes: charData?.first_mes || '',
                mes_example: charData?.mes_example || '',
                creator_notes: charData?.creator_notes || '',
                system_prompt: charData?.system_prompt || '',
                post_history_instructions: charData?.post_history_instructions || '',
                alternate_greetings: Array.isArray(charData?.alternate_greetings) ? charData.alternate_greetings : [],
                character_version: charData?.character_version || '1.0',
                character_book: charData?.character_book || undefined,
                extensions: charData?.extensions || {},
                tagline,
                worldBook: charData?.extensions?.world || '',
                voiceType: 'sweet',
                status: 'online',
                privacyType: 'public',
                lastActiveLabel: '刚刚导入',
                reviews,
                _imported: true,
                _fileName: file,
            });
        } catch {
            logger.debug(`跳过无法解析的角色文件: ${file}`);
        }
    }

    importedCache = { mtimeMs, data: result };
    return result;
}

/**
 * GET /api/discover
 * 返回种子角色 + 导入的角色 + 用户公开角色（短时缓存）
 */
export async function getDiscoverCharacters(_req: Request, res: Response): Promise<void> {
    const now = Date.now();
    if (discoverListCache && discoverListCache.expiresAt > now) {
        res.json(discoverListCache.data);
        return;
    }

    const seedChars = seedService.getSeedCharacters();
    const importedChars = getImportedCharacters();
    const publicChars = await userCharacterService.getAllPublicCharacters();
    const combined = [...seedChars, ...importedChars, ...publicChars];

    discoverListCache = { expiresAt: now + DISCOVER_CACHE_TTL_MS, data: combined };
    res.json(combined);
}

/** 清除 discover 列表缓存（评价/导入后可调用） */
export function invalidateDiscoverCache(): void {
    discoverListCache = null;
    importedCache = null;
}

/**
 * GET /api/discover/:id
 * 返回单个角色详情（种子 + 导入 + 用户公开角色）
 */
export function getDiscoverCharacter(req: Request, res: Response): void {
    const { id } = req.params;

    // 先查种子
    const seed = seedService.getSeedCharacterById(id);
    if (seed) { res.json(seed); return; }

    // 再查导入角色
    const imported = getImportedCharacters().find(c => c.id === id);
    if (imported) { res.json(imported); return; }

    // 最后查用户公开角色（custom_ 前缀）
    if (id.startsWith('custom_')) {
        userCharacterService.getAllPublicCharacters()
            .then(publicChars => {
                const found = publicChars.find(c => c.id === id);
                if (found) {
                    res.json(found);
                } else {
                    res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
                }
            })
                    .catch(() => res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' }));
        return;
    }

    res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
}

/**
 * POST /api/discover/:id/reviews
 * 添加角色评价（支持种子角色、导入 PNG 角色、用户目录 PNG 角色卡、用户创建角色）
 */
export function addReview(req: Request, res: Response, next: NextFunction): void {
    try {
        const { id } = req.params;
        const { username, rating, comment } = req.body;

        if (!username || !rating || !comment) {
            throw new BadRequestError('username, rating, and comment are required');
        }

        const review = {
            id: `r_${Date.now()}`,
            username,
            rating: Number(rating),
            comment,
            date: new Date().toISOString().split('T')[0],
        };

        // 1. 先查种子角色
        const seedUpdated = seedService.addReviewToCharacter(id, review);
        if (seedUpdated) {
            invalidateDiscoverCache();
            res.json(seedUpdated);
            return;
        }

        // 2. 再查导入的 PNG 角色（持久化到 imported-reviews.json）
        const config = getConfig();
        const importedCharactersDir = path.join(config.dataRoot, 'default-user', 'characters');
        if (fs.existsSync(importedCharactersDir)) {
            const importedFiles = fs.readdirSync(importedCharactersDir).filter(f => f.endsWith('.png'));
            const matchedFile = importedFiles.find(f => `imported_${path.parse(f).name}` === id);
            if (matchedFile) {
                const reviews = addImportedReview(matchedFile, review);
                const totalRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
                const avgRating = parseFloat((totalRating / reviews.length).toFixed(1));

                // 重新读取角色基本信息
                const filePath = path.join(importedCharactersDir, matchedFile);
                const imgData = readCharacterCardFromFile(filePath);
                if (imgData) {
                    const jsonData = JSON.parse(imgData);
                    const charData = jsonData.data || jsonData;
                    res.json({
                        id,
                        name: charData?.name || path.parse(matchedFile).name,
                        avatar: `/api/characters/avatar/${encodeURIComponent(matchedFile)}`,
                        creator: charData?.creator || 'Imported',
                        rating: avgRating,
                        reviewCount: reviews.length,
                        tags: Array.isArray(charData?.tags) ? charData.tags : [],
                        description: charData?.description || jsonData.description || '',
                        personality: charData?.personality || '',
                        scenario: charData?.scenario || '',
                        first_mes: charData?.first_mes || '',
                        mes_example: charData?.mes_example || '',
                        creator_notes: charData?.creator_notes || '',
                        system_prompt: charData?.system_prompt || '',
                        post_history_instructions: charData?.post_history_instructions || '',
                        alternate_greetings: Array.isArray(charData?.alternate_greetings) ? charData.alternate_greetings : [],
                        character_version: charData?.character_version || '1.0',
                        extensions: charData?.extensions || {},
                        tagline: '',
                        worldBook: charData?.extensions?.world || '',
                        voiceType: 'sweet',
                        status: 'online',
                        reviews,
                        _imported: true,
                        _fileName: matchedFile,
                    });
                    invalidateDiscoverCache();
                    return;
                }
            }
        }

        // 3. PNG 角色卡（id 以 .png 结尾，如 "奥利弗.png"）
        if (id.endsWith('.png')) {
            const handle = req.session?.handle;
            if (handle) {
                const charactersDir = path.join(config.dataRoot, handle, 'characters');
                const filePath = path.join(charactersDir, id);
                if (fs.existsSync(filePath)) {
                    const imgData = readCharacterCardFromFile(filePath);
                    if (imgData) {
                        const jsonData = JSON.parse(imgData);
                        const charData = jsonData.data || jsonData;

                        // 持久化评价到 png-reviews.json
                        const relativeKey = `${handle}/characters/${id}`;
                        const reviews = addPngReview(relativeKey, review);
                        const totalRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
                        const avgRating = parseFloat((totalRating / reviews.length).toFixed(1));

                        res.json({
                            id,
                            name: charData?.name || '',
                            avatar: `/api/characters/avatar/${encodeURIComponent(id)}`,
                            creator: charData?.creator || 'Imported',
                            rating: avgRating,
                            reviewCount: reviews.length,
                            tags: Array.isArray(charData?.tags) ? charData.tags : [],
                            description: charData?.description || '',
                            personality: charData?.personality || '',
                            scenario: charData?.scenario || '',
                            first_mes: charData?.first_mes || '',
                            mes_example: charData?.mes_example || '',
                            creator_notes: charData?.creator_notes || '',
                            system_prompt: charData?.system_prompt || '',
                            post_history_instructions: charData?.post_history_instructions || '',
                            alternate_greetings: Array.isArray(charData?.alternate_greetings) ? charData.alternate_greetings : [],
                            character_version: charData?.character_version || '1.0',
                            extensions: charData?.extensions || {},
                            tagline: '',
                            worldBook: charData?.extensions?.world || '',
                            voiceType: 'sweet',
                            status: 'online',
                            reviews,
                        });
                        return;
                    }
                }
            }
            res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
            return;
        }

        // 4. 用户创建的角色（custom_ 前缀）
        const handle = req.session?.handle;
        if (handle && id.startsWith('custom_')) {
            userCharacterService.addReviewToUserCharacter(handle, id, review)
                .then(updated => {
                    if (updated) {
                        res.json(updated);
                    } else {
                        res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
                    }
                })
                        .catch(() => res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' }));
            return;
        }

        res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
    } catch (err) {
        next(err);
    }
}
