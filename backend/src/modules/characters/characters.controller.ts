import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as characterService from './characters.service.js';
import { readCharacterCardFromFile } from './characters.parser.js';
import * as userCharacterService from './characters.user.service.js';
import { BadRequestError, NotFoundError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../users/users.repository.js';

function getUserDirs(req: Request) {
    const session = req.session as Record<string, any>;
    const handle = session?.handle as string;
    const config = getConfig();
    return getUserDirectories(config.dataRoot, handle);
}

/**
 * POST /api/characters/all
 */
export function getAllCharacters(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const shallow = req.body?.shallow === true;
        const characters = characterService.getAllCharacters(dirs.characters, dirs.chats, shallow);
        res.json(characters);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/characters/get
 */
export function getCharacter(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const character = characterService.getCharacter(avatarUrl, dirs.characters, dirs.chats);
        res.json(character);
    } catch (err) {
        if (err instanceof NotFoundError) {
            res.status(404).json({ error: 'Character not found' });
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
        if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }
        const { name, tagline, description, worldBook, tags, voiceType, avatar } = req.body;
        if (!name) throw new BadRequestError('name is required');

        const character = await userCharacterService.publishCharacter(handle, {
            name, tagline, description, worldBook, tags, voiceType, avatar,
        });
        res.json(character);
    } catch (err) {
        next(err);
    }
}

function buildCharData(body: Record<string, unknown>): Record<string, unknown> {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        name: body.name || body.ch_name || '',
        description: body.description || '',
        personality: body.personality || '',
        scenario: body.scenario || '',
        first_mes: body.first_mes || '',
        mes_example: body.mes_example || '',
        creatorcomment: body.creator_notes || '',
        talkativeness: body.talkativeness || 0.5,
        fav: body.fav === true || body.fav === 'true',
        tags: typeof body.tags === 'string' ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (body.tags || []),
        data: {
            name: body.name || body.ch_name || '',
            description: body.description || '',
            personality: body.personality || '',
            scenario: body.scenario || '',
            first_mes: body.first_mes || '',
            mes_example: body.mes_example || '',
            creator_notes: body.creator_notes || '',
            system_prompt: body.system_prompt || '',
            post_history_instructions: body.post_history_instructions || '',
            tags: typeof body.tags === 'string' ? body.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : (body.tags || []),
            creator: body.creator || '',
            character_version: body.character_version || '',
            alternate_greetings: [],
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
