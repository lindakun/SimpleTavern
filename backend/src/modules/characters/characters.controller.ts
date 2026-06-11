import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as characterService from './characters.service.js';
import { readCharacterCardFromFile } from './characters.parser.js';
import * as userCharacterService from './characters.user.service.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../users/users.repository.js';
import { logger } from '../../common/logger.js';

function getUserDirs(req: Request) {
    const session = req.session as Record<string, any>;
    const handle = session?.handle as string;
    const config = getConfig();
    return getUserDirectories(config.dataRoot, handle);
}

/** 获取 default-user 的角色目录（供全局共享） */
function getDefaultUserDirs() {
    const config = getConfig();
    return getUserDirectories(config.dataRoot, 'default-user');
}

/** 当前登录用户是否为 default-user */
function isDefaultUser(req: Request): boolean {
    const session = req.session as Record<string, any>;
    return session?.handle === 'default-user';
}

/**
 * POST /api/characters/all
 * 非 default-user 用户也会看到 default-user 创建的角色
 */
export function getAllCharacters(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const shallow = req.body?.shallow === true;
        const characters = characterService.getAllCharacters(dirs.characters, dirs.chats, shallow);

        // 非 default-user 用户也能查看 default-user 的角色
        if (!isDefaultUser(req)) {
            const defaultDirs = getDefaultUserDirs();
            if (fs.existsSync(defaultDirs.characters)) {
                const defaultChars = characterService.getAllCharacters(
                    defaultDirs.characters, defaultDirs.chats, shallow,
                );
                const existingNames = new Set(characters.map(c => String(c.avatar)));
                for (const dc of defaultChars) {
                    if (!existingNames.has(String(dc.avatar))) {
                        characters.push(dc);
                    }
                }
            }
        }

        res.json(characters);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/get
 * 非 default-user 用户也能获取 default-user 的角色
 */
export function getCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');

        let character: Record<string, unknown> | null = null;

        // 先查当前用户目录
        const ownFilePath = path.join(dirs.characters, avatarUrl);
        if (fs.existsSync(ownFilePath)) {
            character = characterService.getCharacter(avatarUrl, dirs.characters, dirs.chats);
        }

        // 回退到 default-user 目录
        if (!character && !isDefaultUser(req)) {
            const defaultDirs = getDefaultUserDirs();
            const defaultFilePath = path.join(defaultDirs.characters, avatarUrl);
            if (fs.existsSync(defaultFilePath)) {
                character = characterService.getCharacter(avatarUrl, defaultDirs.characters, defaultDirs.chats);
            }
        }

        if (!character) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
            return;
        }

        res.json(character);
    } catch (err) {
        if (err instanceof NotFoundError) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Character not found' });
            return;
        }
        next(err);
    }
}

/**
 * POST /api/characters/create
 */
export function createCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const name = String(req.body.name || req.body.ch_name || '');
        if (!name) {
            throw new BadRequestError('Character name is required');
        }
        const charData = buildCharData(req.body);
        const fileName = characterService.createCharacter(name, dirs.characters, charData);
        res.json({ path: fileName });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/edit
 */
export function editCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        if (!avatarUrl) throw new BadRequestError('avatar_url is required');

        const charData = buildCharData(req.body);
        const success = characterService.editCharacter(avatarUrl, dirs.characters, charData);
        res.json({ ok: success });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/delete
 */
export function deleteCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        if (!avatarUrl) throw new BadRequestError('avatar_url is required');

        characterService.removeCharacter(avatarUrl, dirs.characters);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/rename
 */
export function renameCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const newName = String(req.body.name || req.body.ch_name || '');
        if (!avatarUrl || !newName) throw new BadRequestError('avatar_url and name are required');

        const newFileName = characterService.renameCharacter(avatarUrl, newName, dirs.characters, dirs.chats);
        res.json({ path: newFileName });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/duplicate
 */
export function duplicateCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        if (!avatarUrl) throw new BadRequestError('avatar_url is required');

        const character = characterService.getCharacter(avatarUrl, dirs.characters, dirs.chats);
        delete character.chat;
        const newName = String(character.name || '') + ' (copy)';
        const charData = buildCharData({ ...character, name: newName, ch_name: newName });
        const fileName = characterService.createCharacter(newName, dirs.characters, charData);
        res.json({ path: fileName });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/export
 */
export function exportCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        if (!avatarUrl) throw new BadRequestError('avatar_url is required');

        const filePath = path.join(dirs.characters, avatarUrl);
        if (!fs.existsSync(filePath)) {
            throw new NotFoundError('Character', avatarUrl);
        }

        res.sendFile(filePath);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/chats — 获取角色的所有聊天
 */
export function getCharacterChats(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        if (!avatarUrl) throw new BadRequestError('avatar_url is required');

        const chatDir = path.join(dirs.chats, avatarUrl.replace('.png', ''));
        if (!fs.existsSync(chatDir)) {
            res.json([]);
            return;
        }

        const files = fs.readdirSync(chatDir)
            .filter((f: string) => f.endsWith('.jsonl'))
            .map((f: string) => {
                const stat = fs.statSync(path.join(chatDir, f));
                return {
                    file_id: path.parse(f).name,
                    file_name: f,
                    file_size: stat.size,
                    last_mes: stat.mtimeMs,
                };
            })
            .sort((a: any, b: any) => b.last_mes - a.last_mes);

        res.json(files);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/import
 */
export function importCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const file = (req as any).file;
        if (!file) throw new BadRequestError('No file uploaded');

        const uploadPath = file.path;
        const ext = path.extname(file.originalname).toLowerCase();

        if (ext === '.png') {
            const imgData = readCharacterCardFromFile(uploadPath);
            const jsonData = JSON.parse(imgData);
            const name = jsonData.data?.name || jsonData.name || 'imported';
            const pngName = characterService.getPngName(name, dirs.characters);
            const destPath = path.join(dirs.characters, pngName);
            fs.copyFileSync(uploadPath, destPath);
            fs.unlinkSync(uploadPath);
            res.json({ path: pngName });
        } else if (ext === '.json') {
            const data = fs.readFileSync(uploadPath, 'utf8');
            fs.unlinkSync(uploadPath);
            const jsonData = JSON.parse(data);
            const name = jsonData.name || jsonData.char_name || 'imported';
            const charData = buildCharData(jsonData);
            const pngName = characterService.createCharacter(name, dirs.characters, charData);
            res.json({ path: pngName });
        } else {
            fs.unlinkSync(uploadPath);
            throw new BadRequestError(`Unsupported file format: ${ext}`);
        }
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/publish — 发布自定义角色
 * 前端 CreateCharacterScreen 的入口
 */
export async function publishCharacter(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const handle = (req.session as Record<string, any>)?.handle;
        if (!handle) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' }); return; }
        const { name } = req.body;
        if (!name) throw new BadRequestError('name is required');

        const character = await userCharacterService.publishCharacter(handle, {
            name,
            description: req.body.description,
            personality: req.body.personality,
            scenario: req.body.scenario,
            first_mes: req.body.first_mes,
            mes_example: req.body.mes_example,
            creator_notes: req.body.creator_notes,
            system_prompt: req.body.system_prompt,
            post_history_instructions: req.body.post_history_instructions,
            alternate_greetings: req.body.alternate_greetings,
            tags: req.body.tags,
            creator: req.body.creator,
            character_version: req.body.character_version,
            avatar: req.body.avatar,
            // 兼容旧字段
            tagline: req.body.tagline,
            worldBook: req.body.worldBook,
            voiceType: req.body.voiceType,
        });
        res.json(character);
    } catch (err) {
        next(err);
    }
}

function parseTags(tags: unknown): string[] {
    if (typeof tags === 'string') {
        return tags.split(',').map((t: string) => t.trim()).filter(Boolean);
    }
    return Array.isArray(tags) ? tags : [];
}

function parseAlternateGreetings(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((g: unknown) => typeof g === 'string');
    return [];
}

function buildCharData(body: Record<string, unknown>): Record<string, unknown> {
    const name = String(body.name || body.ch_name || '');
    const tags = parseTags(body.tags);
    const alternateGreetings = parseAlternateGreetings(body.alternate_greetings);

    return {
        spec: 'chara_card_v3',
        spec_version: '3.0',
        name,
        description: body.description || '',
        personality: body.personality || '',
        scenario: body.scenario || '',
        first_mes: body.first_mes || '',
        mes_example: body.mes_example || '',
        creatorcomment: body.creator_notes || '',
        talkativeness: body.talkativeness || 0.5,
        fav: body.fav === true || body.fav === 'true',
        tags,
        data: {
            name,
            description: body.description || '',
            personality: body.personality || '',
            scenario: body.scenario || '',
            first_mes: body.first_mes || '',
            mes_example: body.mes_example || '',
            creator_notes: body.creator_notes || '',
            system_prompt: body.system_prompt || '',
            post_history_instructions: body.post_history_instructions || '',
            tags,
            creator: body.creator || '',
            character_version: body.character_version || '1.0',
            alternate_greetings: alternateGreetings,
            extensions: {
                talkativeness: body.talkativeness || 0.5,
                fav: body.fav === true || body.fav === 'true',
                world: body.world || '',
                depth_prompt: {
                    prompt: body.depth_prompt_prompt || '',
                    depth: Number(body.depth_prompt_depth) || 4,
                    role: body.depth_prompt_role || 'system',
                },
            },
        },
    };
}
