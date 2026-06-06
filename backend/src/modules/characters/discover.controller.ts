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

/**
 * 扫描用户目录，获取导入的 PNG 角色卡
 * 附带持久化的评价数据
 */
function getImportedCharacters(): any[] {
    const config = getConfig();
    const charactersDir = path.join(config.dataRoot, 'default-user', 'characters');
    const result: any[] = [];

    if (!fs.existsSync(charactersDir)) return result;

    // 加载导入角色的评价数据
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

            // 合并持久化评价
            const reviews = importedReviews[file] || [];
            const totalRating = reviews.reduce((sum: number, r: any) => sum + r.rating, 0);
            const avgRating = reviews.length > 0
                ? parseFloat((totalRating / reviews.length).toFixed(1))
                : 0;

            result.push({
                id: `imported_${path.parse(file).name}`,
                name,
                avatar: `/api/characters/avatar/${encodeURIComponent(file)}`,
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
                lastActiveLabel: '刚刚导入',
                reviews,
                _imported: true,
                _fileName: file,
            });
        } catch (err) {
            logger.debug(`跳过无法解析的角色文件: ${file}`);
        }
    }

    return result;
}

/**
 * GET /api/discover
 * 返回种子角色 + 导入的角色
 */
export function getDiscoverCharacters(_req: Request, res: Response): void {
    const seedChars = seedService.getSeedCharacters();
    const importedChars = getImportedCharacters();
    const combined = [...seedChars, ...importedChars];
    res.json(combined);
}

/**
 * GET /api/discover/:id
 * 返回单个角色详情（种子 + 导入）
 */
export function getDiscoverCharacter(req: Request, res: Response): void {
    const { id } = req.params;

    // 先查种子
    const seed = seedService.getSeedCharacterById(id);
    if (seed) { res.json(seed); return; }

    // 再查导入角色
    const imported = getImportedCharacters().find(c => c.id === id);
    if (imported) { res.json(imported); return; }

    res.status(404).json({ error: 'Character not found' });
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
                    return;
                }
            }
        }

        // 3. PNG 角色卡（id 以 .png 结尾，如 "奥利弗.png"）
        if (id.endsWith('.png')) {
            const handle = (req as any).session?.handle;
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
            res.status(404).json({ error: 'Character not found' });
            return;
        }

        // 4. 用户创建的角色（custom_ 前缀）
        const handle = (req as any).session?.handle;
        if (handle && id.startsWith('custom_')) {
            userCharacterService.addReviewToUserCharacter(handle, id, review)
                .then(updated => {
                    if (updated) {
                        res.json(updated);
                    } else {
                        res.status(404).json({ error: 'Character not found' });
                    }
                })
                .catch(() => res.status(404).json({ error: 'Character not found' }));
            return;
        }

        res.status(404).json({ error: 'Character not found' });
    } catch (err) {
        next(err);
    }
}
