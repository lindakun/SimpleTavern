import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as characterController from './characters.controller.js';
import * as userCharacterService from './characters.user.service.js';
import * as characterService from './characters.service.js';
import { getAllPngReviews } from './reviews.repository.js';
import { readCharacterCardFromFile } from './characters.parser.js';
import { BadRequestError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../users/users.repository.js';

function getHandle(req: any): string | null {
    return req.session?.handle || null;
}

export function createPublicCharacterRoutes(): Router {
    const router = Router();

    router.post('/characters/publish', characterController.publishCharacter);

    // 复制公共角色到当前用户（前端传入角色完整数据）
    router.post('/characters/copy', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            if (!req.body.name) {
                res.status(400).json({ error: 'name is required' });
                return;
            }

            const copy = await userCharacterService.publishCharacter(handle, {
                name: req.body.name,
                description: req.body.description || '',
                personality: req.body.personality || '',
                scenario: req.body.scenario || '',
                first_mes: req.body.first_mes || '',
                mes_example: req.body.mes_example || '',
                creator_notes: req.body.creator_notes || '',
                system_prompt: req.body.system_prompt || '',
                post_history_instructions: req.body.post_history_instructions || '',
                alternate_greetings: req.body.alternate_greetings || [],
                tags: req.body.tags || [],
                creator: handle,
                character_version: req.body.character_version || '1.0',
                avatar: req.body.avatar || '',
                tagline: req.body.tagline || '',
                worldBook: req.body.worldBook || '',
                voiceType: req.body.voiceType || 'sweet',
                privacyType: 'private',
            });
            res.json(copy);
        } catch (err) {
            next(err);
        }
    });

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
                privacyType: req.body.privacyType,
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

    // 快捷切换角色隐私类型
    router.post('/users/characters/privacy', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            const characterId = String(req.body.characterId || '');
            const privacyType = req.body.privacyType;
            if (!characterId || !privacyType) {
                res.status(400).json({ error: 'characterId and privacyType are required' });
                return;
            }
            if (privacyType !== 'public' && privacyType !== 'private') {
                res.status(400).json({ error: 'privacyType must be "public" or "private"' });
                return;
            }

            const updated = await userCharacterService.updateCharacterPrivacy(handle, characterId, privacyType);
            if (!updated) {
                res.status(404).json({ error: 'Character not found' });
                return;
            }

            res.json(updated);
        } catch (err) {
            next(err);
        }
    });

    // 辅助函数：将原始角色数据映射为前端 Character 格式
    function mapPngCharacters(pngChars: Record<string, unknown>[], handle: string, pngReviews: Record<string, any[]>): any[] {
        return pngChars.map(c => {
            const fileName = String(c.avatar || '');
            const relativeKey = `${handle}/characters/${fileName}`;
            const reviews = pngReviews[relativeKey] || [];
            // 也尝试 default-user 的评价
            const defaultKey = `default-user/characters/${fileName}`;
            const allReviews = [...reviews, ...(pngReviews[defaultKey] || [])];
            const totalRating = allReviews.reduce((sum: number, r: any) => sum + r.rating, 0);
            const avgRating = allReviews.length > 0
                ? parseFloat((totalRating / allReviews.length).toFixed(1))
                : 0;

            return {
                id: fileName,
                name: String(c.name || ''),
                avatar: `/api/characters/avatar/${encodeURIComponent(fileName)}`,
                creator: String((c.data as any)?.creator || ''),
                rating: avgRating,
                reviewCount: allReviews.length,
                reviews: allReviews,
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
                privacyType: (handle === 'default-user' ? 'public' : 'private') as 'public' | 'private',
            };
        });
    }

    // 获取当前用户的 PNG 角色卡列表（映射为前端 Character 格式，含持久化评价）
    // 非 default-user 用户也能看到 default-user 的角色
    router.get('/users/png-characters', (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.json([]); return; }

            const config = getConfig();
            const dirs = getUserDirectories(config.dataRoot, handle);
            const pngChars = characterService.getAllCharacters(dirs.characters, dirs.chats, false);

            // 加载用户 PNG 角色的持久化评价
            const pngReviews = getAllPngReviews();

            const characters = mapPngCharacters(pngChars, handle, pngReviews);

            // 非 default-user 用户也显示 default-user 创建的角色
            if (handle !== 'default-user') {
                const defaultDirs = getUserDirectories(config.dataRoot, 'default-user');
                if (fs.existsSync(defaultDirs.characters)) {
                    const defaultPngChars = characterService.getAllCharacters(
                        defaultDirs.characters, defaultDirs.chats, false,
                    );
                    const existingIds = new Set(characters.map(c => String(c.id)));
                    const defaultMapped = mapPngCharacters(defaultPngChars, 'default-user', pngReviews);
                    for (const dc of defaultMapped) {
                        if (!existingIds.has(String(dc.id))) {
                            characters.push(dc);
                        }
                    }
                }
            }

            res.json(characters);
        } catch (err) {
            next(err);
        }
    });

    // 获取角色 PNG 头像图片（公开访问，无需登录）
    // 未登录时直接从 default-user 目录提供（用于 Discovery 页面）
    // 已登录时先查当前用户目录，再回退到 default-user 目录
    router.get('/characters/avatar/:filename', (req, res, next) => {
        try {
            const handle = getHandle(req);
            const config = getConfig();

            // 辅助函数：尝试从指定目录提供文件
            // 如果角色PNG中嵌入了 ugirl_url，则302重定向到原始头像
            const tryServeFromDir = (charDir: string): boolean => {
                const resolvedDir = path.resolve(charDir);
                const filePath = path.resolve(resolvedDir, req.params.filename);

                // 防止路径遍历
                if (!filePath.startsWith(resolvedDir + path.sep) && filePath !== resolvedDir) {
                    return false;
                }

                if (!fs.existsSync(filePath)) {
                    return false;
                }

                // 尝试从PNG中提取ugirl原始头像URL
                try {
                    const jsonStr = readCharacterCardFromFile(filePath);
                    const charData = JSON.parse(jsonStr);
                    const ugirlUrl = (charData as any)?.data?.extensions?.ugirl_url;
                    if (ugirlUrl && typeof ugirlUrl === 'string' && ugirlUrl.startsWith('http')) {
                        res.redirect(302, ugirlUrl);
                        return true;
                    }
                } catch {
                    // PNG中没有角色数据或无法解析，继续正常提供文件
                }

                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.sendFile(filePath);
                return true;
            };

            if (handle) {
                // 已登录：先查当前用户目录
                const dirs = getUserDirectories(config.dataRoot, handle);
                if (tryServeFromDir(dirs.characters)) return;
            }

            // 回退到 default-user 目录（用户不是 default-user 或未登录时）
            if (handle !== 'default-user') {
                const defaultDirs = getUserDirectories(config.dataRoot, 'default-user');
                if (tryServeFromDir(defaultDirs.characters)) return;
            }

            res.status(404).json({ error: 'Not found' });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
