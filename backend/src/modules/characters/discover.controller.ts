import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as seedService from './seed.service.js';
import { readCharacterCardFromFile } from './characters.parser.js';
import { BadRequestError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../common/logger.js';

/**
 * 扫描用户目录，获取导入的 PNG 角色卡
 */
function getImportedCharacters(): any[] {
    const config = getConfig();
    const charactersDir = path.join(config.dataRoot, 'default-user', 'characters');
    const result: any[] = [];

    if (!fs.existsSync(charactersDir)) return result;

    const files = fs.readdirSync(charactersDir).filter(f => f.endsWith('.png'));
    for (const file of files) {
        try {
            const filePath = path.join(charactersDir, file);
            const imgData = readCharacterCardFromFile(filePath);
            if (!imgData) continue;

            const jsonData = JSON.parse(imgData);
            const charData = jsonData.data || jsonData;
            const name = charData?.name || jsonData.name || path.parse(file).name;

            result.push({
                id: `imported_${path.parse(file).name}`,
                name,
                avatar: '',  // 前端会用文件名匹配
                creator: charData?.creator || 'Imported',
                rating: 0,
                reviewCount: 0,
                tags: Array.isArray(charData?.tags) ? charData.tags : [],
                description: charData?.description || jsonData.description || '',
                // V3 字段
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
                // 兼容旧字段
                tagline: '',
                worldBook: charData?.extensions?.world || '',
                voiceType: 'sweet',
                status: 'online',
                lastActiveLabel: '刚刚导入',
                reviews: [],
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
 * 添加角色评价
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

        const updated = seedService.addReviewToCharacter(id, review);
        if (!updated) {
            res.status(404).json({ error: 'Character not found' });
            return;
        }

        res.json(updated);
    } catch (err) {
        next(err);
    }
}
