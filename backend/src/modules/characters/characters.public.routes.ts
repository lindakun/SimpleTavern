import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as characterController from './characters.controller.js';
import * as userCharacterService from './characters.user.service.js';
import * as characterService from './characters.service.js';
import { getAllPngReviews } from './reviews.repository.js';
import { BadRequestError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../users/users.repository.js';

function getHandle(req: any): string | null {
    return req.session?.handle || null;
}

export function createPublicCharacterRoutes(): Router {
    const router = Router();

    router.post('/characters/publish', characterController.publishCharacter);

    router.get('/users/characters', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.json([]); return; }
            const characters = await userCharacterService.getUserCharacters(handle);
            res.json(characters);
        } catch (err) {
            next(err);
        }
    });

    router.post('/users/characters/edit', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            const characterId = String(req.body.id || req.body.characterId || '');
            if (!characterId) throw new BadRequestError('characterId is required');

            const updated = await userCharacterService.updateUserCharacter(handle, characterId, {
                name: req.body.name,
                avatar: req.body.avatar,
                description: req.body.description,
                tags: req.body.tags,
                rating: req.body.rating,
                reviewCount: req.body.reviewCount,
                status: req.body.status,
                // V3 字段
                personality: req.body.personality,
                scenario: req.body.scenario,
                first_mes: req.body.first_mes,
                mes_example: req.body.mes_example,
                creator_notes: req.body.creator_notes,
                system_prompt: req.body.system_prompt,
                post_history_instructions: req.body.post_history_instructions,
                alternate_greetings: req.body.alternate_greetings,
                character_version: req.body.character_version,
                extensions: req.body.extensions,
                // 兼容旧字段
                tagline: req.body.tagline,
                worldBook: req.body.worldBook,
                voiceType: req.body.voiceType,
            });

            if (!updated) {
                res.status(404).json({ error: 'Character not found' });
                return;
            }

            res.json(updated);
        } catch (err) {
            next(err);
        }
    });

    router.post('/users/characters/delete', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            const characterId = String(req.body.id || req.body.characterId || '');
            if (!characterId) throw new BadRequestError('characterId is required');

            const deleted = await userCharacterService.deleteUserCharacter(handle, characterId);
            if (!deleted) {
                res.status(404).json({ error: 'Character not found' });
                return;
            }

            res.json({ ok: true });
        } catch (err) {
            next(err);
        }
    });

    // 获取当前用户的 PNG 角色卡列表（映射为前端 Character 格式）
    router.get('/users/png-characters', (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.json([]); return; }

            const config = getConfig();
            const dirs = getUserDirectories(config.dataRoot, handle);
            const pngChars = characterService.getAllCharacters(dirs.characters, dirs.chats, false);

            const characters = pngChars.map(c => ({
                id: String(c.avatar || ''),
                name: String(c.name || ''),
                avatar: `/api/characters/avatar/${encodeURIComponent(String(c.avatar || ''))}`,
                creator: String((c.data as any)?.creator || ''),
                rating: 0,
                reviewCount: 0,
                tags: Array.isArray(c.tags) ? c.tags : [],
                description: String(c.description || (c.data as any)?.description || ''),
                // V3 字段
                personality: String((c.data as any)?.personality || ''),
                scenario: String((c.data as any)?.scenario || ''),
                first_mes: String((c.data as any)?.first_mes || ''),
                mes_example: String((c.data as any)?.mes_example || ''),
                creator_notes: String((c.data as any)?.creator_notes || ''),
                system_prompt: String((c.data as any)?.system_prompt || ''),
                post_history_instructions: String((c.data as any)?.post_history_instructions || ''),
                alternate_greetings: Array.isArray((c.data as any)?.alternate_greetings) ? (c.data as any).alternate_greetings : [],
                character_version: String((c.data as any)?.character_version || '1.0'),
                extensions: (c.data as any)?.extensions || {},
                // 兼容旧字段
                tagline: '',
                worldBook: String((c.data as any)?.extensions?.world || ''),
                voiceType: 'sweet' as const,
                status: 'online' as const,
            }));

            res.json(characters);
        } catch (err) {
            next(err);
        }
    });

    // 获取角色 PNG 头像图片（公开，通过 session 获取用户目录）
    router.get('/characters/avatar/:filename', (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            const config = getConfig();
            const dirs = getUserDirectories(config.dataRoot, handle);
            const resolvedDir = path.resolve(dirs.characters);
            const filePath = path.resolve(resolvedDir, req.params.filename);

            // 防止路径遍历
            if (!filePath.startsWith(resolvedDir + path.sep) && filePath !== resolvedDir) {
                res.status(403).json({ error: 'Forbidden' });
                return;
            }

            if (!fs.existsSync(filePath)) {
                res.status(404).json({ error: 'Not found' });
                return;
            }

            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.sendFile(filePath);
        } catch (err) {
            next(err);
        }
    });

    return router;
}
