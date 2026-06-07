import { Request, Response, NextFunction } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import * as chatService from './chats.service.js';
import { readChatFile, writeChatFile, listChatFiles, readFirstLine, readPinnedList } from './chats.repository.js';
import { BadRequestError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../users/users.repository.js';

function getUserDirs(req: Request) {
    const session = req.session as Record<string, any>;
    const handle = session?.handle as string;
    const config = getConfig();
    return getUserDirectories(config.dataRoot, handle);
}

function getSessionHandle(req: Request): string | null {
    const session = req.session as Record<string, any>;
    return session?.handle || null;
}

/**
 * POST /api/chats/save
 */
export function saveChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const fileName = String(req.body.file_name || '');
        const chatData = req.body.chat;

        if (!avatarUrl || !fileName) {
            throw new BadRequestError('Missing required fields');
        }
        if (!Array.isArray(chatData)) {
            res.status(400).json({ error: 'The request\'s body.chat is not an array.' });
            return;
        }

        const charName = avatarUrl.replace('.png', '');
        chatService.saveChat(dirs.chats, charName, fileName, chatData);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/get
 */
export function getChat(req: Request, res: Response, _next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const fileName = req.body.file_name;

        if (!avatarUrl) {
            throw new BadRequestError('avatar_url is required');
        }

        const charName = avatarUrl.replace('.png', '');

        if (!fileName) {
            res.json({});
            return;
        }

        const chatData = chatService.getChatData(dirs.chats, charName, String(fileName));
        res.json(chatData);
    } catch {
        res.json({});
    }
}

/**
 * POST /api/chats/rename
 */
export function renameChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const originalFile = String(req.body.original_file || '');
        const renamedFile = String(req.body.renamed_file || '');

        if (!avatarUrl || !originalFile || !renamedFile) {
            res.sendStatus(400);
            return;
        }

        const charName = avatarUrl.replace('.png', '');
        chatService.renameChat(dirs.chats, charName, originalFile, renamedFile);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/delete
 */
export function deleteChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const fileName = String(req.body.file_name || '');

        if (!avatarUrl || !fileName) {
            throw new BadRequestError('Missing required fields');
        }

        const charName = avatarUrl.replace('.png', '');
        chatService.deleteChat(dirs.chats, charName, fileName);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/export
 */
export function exportChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const fileName = String(req.body.file_name || '');

        if (!avatarUrl || !fileName) throw new BadRequestError('Missing required fields');

        const charName = avatarUrl.replace('.png', '');
        const chatData = chatService.getChatData(dirs.chats, charName, fileName);

        res.setHeader('Content-Type', 'application/json');
        res.json(chatData);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/import
 */
export function importChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const avatarUrl = String(req.body.avatar_url || '');
        const fileName = String(req.body.file_name || '');

        if (!avatarUrl || !fileName) throw new BadRequestError('Missing required fields');

        const file = (req as any).file;
        if (!file) throw new BadRequestError('No file uploaded');

        const uploadPath = file.path;
        const content = fs.readFileSync(uploadPath, 'utf-8');
        fs.unlinkSync(uploadPath);

        const charName = avatarUrl.replace('.png', '');
        const chatData = JSON.parse(content);
        chatService.saveChat(dirs.chats, charName, fileName, chatData);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/group/get
 */
export function getGroupChat(req: Request, res: Response, _next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const file = String(req.body.file || '');

        if (!file) {
            res.json({});
            return;
        }

        const filePath = path.join(dirs.chats, file);
        if (!fs.existsSync(filePath)) {
            res.json({});
            return;
        }

        const data = readChatFile(filePath);
        res.json(data);
    } catch {
        res.json({});
    }
}

/**
 * POST /api/chats/group/save
 */
export function saveGroupChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const file = String(req.body.file || '');
        const data = req.body.data;

        if (!file || !data) throw new BadRequestError('Missing required fields');

        const filePath = path.join(dirs.chats, file);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        writeChatFile(filePath, data);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/group/delete
 */
export function deleteGroupChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const file = String(req.body.file || '');

        if (!file) throw new BadRequestError('Missing required fields');

        const filePath = path.join(dirs.chats, file);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/group/import
 */
export function importGroupChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const file = String(req.body.file || '');

        if (!file) throw new BadRequestError('Missing required fields');

        const uploadFile = (req as any).file;
        if (!uploadFile) throw new BadRequestError('No file uploaded');

        const uploadPath = uploadFile.path;
        const content = fs.readFileSync(uploadPath, 'utf-8');
        fs.unlinkSync(uploadPath);

        const filePath = path.join(dirs.chats, file);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/chat/threads — 获取所有聊天线程
 */
export function getChatThreads(req: Request, res: Response, next: NextFunction): void {
    try {
        const handle = getSessionHandle(req);
        if (!handle) { res.json([]); return; }
        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);

        if (!fs.existsSync(dirs.chats)) {
            res.json([]);
            return;
        }

        const entries = fs.readdirSync(dirs.chats, { withFileTypes: true });
        const threads: any[] = [];
        const pinnedSet = new Set(readPinnedList(dirs.chats));

        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const chatDir = path.join(dirs.chats, entry.name);
            const files = listChatFiles(chatDir);
            if (files.length === 0) continue;

            const latestFile = files[files.length - 1];
            const filePath = path.join(chatDir, latestFile);
            const firstLine = readFirstLine(filePath);
            const meta = firstLine ? tryParseJson(firstLine) : {};
            const chatData = readChatFile(filePath);
            const lastMsg = chatData.length > 1 ? chatData[chatData.length - 1] : null;
            const charName = meta?.character_name || entry.name;

            threads.push({
                characterId: entry.name,
                characterName: charName,
                lastMessageText: lastMsg?.mes || '',
                lastActive: normalizeSendDate(lastMsg?.send_date, filePath),
                messageCount: Math.max(0, chatData.length - 1),
                pinned: pinnedSet.has(entry.name),
            });
        }

        // 置顶优先，然后按最后活跃时间排序
        threads.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return String(b.lastActive).localeCompare(String(a.lastActive));
        });
        res.json(threads);
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/chat/threads/:characterId — 获取特定角色的聊天历史
 */
export function getThreadHistory(req: Request, res: Response, next: NextFunction): void {
    try {
        const handle = getSessionHandle(req);
        if (!handle) { res.json([]); return; }
        const config = getConfig();
        const dirs = getUserDirectories(config.dataRoot, handle);
        const { characterId } = req.params;
        if (!characterId) { res.json([]); return; }

        const chatDir = path.join(dirs.chats, characterId);
        if (!fs.existsSync(chatDir)) { res.json([]); return; }

        const files = listChatFiles(chatDir);
        const allMessages: any[] = [];

        for (const file of files) {
            const filePath = path.join(chatDir, file);
            const chatData = readChatFile(filePath);
            for (const msg of chatData) {
                allMessages.push({ ...msg, chatFile: file });
            }
        }

        res.json(allMessages);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/batch-delete — 批量删除聊天
 */
export function batchDeleteChats(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const { characterIds } = req.body;

        if (!Array.isArray(characterIds) || characterIds.length === 0) {
            throw new BadRequestError('characterIds must be a non-empty array');
        }

        const deletedCount = chatService.batchDeleteChats(dirs.chats, characterIds);
        res.json({ ok: true, deletedCount });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/chats/pin — 置顶/取消置顶聊天
 */
export function togglePinChat(req: Request, res: Response, next: NextFunction): void {
    try {
        const dirs = getUserDirs(req);
        const { characterId, pinned } = req.body;

        if (!characterId || typeof pinned !== 'boolean') {
            throw new BadRequestError('characterId and pinned (boolean) are required');
        }

        const result = chatService.togglePinChat(dirs.chats, characterId, pinned);
        res.json({ ok: true, pinned: result });
    } catch (err) {
        next(err);
    }
}

function tryParseJson(text: string): any {
    try { return JSON.parse(text); } catch { return {}; }
}

/**
 * 标准化 send_date 为 ISO 8601 字符串，兼容 SillyTavern 格式
 */
function normalizeSendDate(sendDate: string | undefined, filePath?: string): string {
    if (!sendDate) return '';

    // 已经是有效日期（ISO 8601 / Unix timestamp）
    const direct = new Date(sendDate);
    if (!isNaN(direct.getTime())) return direct.toISOString();

    // SillyTavern 格式: "YYYY-MM-DD @HHh MMm SSs MSms"
    const stMatch = sendDate.match(/^(\d{4}-\d{2}-\d{2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s/);
    if (stMatch) {
        const [, date, hours, mins, secs] = stMatch;
        const isoStr = `${date}T${hours.padStart(2, '0')}:${mins.padStart(2, '0')}:${secs.padStart(2, '0')}`;
        const stParsed = new Date(isoStr);
        if (!isNaN(stParsed.getTime())) return stParsed.toISOString();
    }

    // 纯时间格式 "HH:MM" — 用文件 mtime 的 UTC 日期 + 时间组合，避免时区漂移
    const timeMatch = sendDate.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch && filePath) {
        try {
            const stats = fs.statSync(filePath);
            const mtime = stats.mtime;
            const [, hours, mins] = timeMatch;
            const isoStr = `${mtime.getUTCFullYear()}-${String(mtime.getUTCMonth() + 1).padStart(2, '0')}-${String(mtime.getUTCDate()).padStart(2, '0')}T${hours.padStart(2, '0')}:${mins.padStart(2, '0')}:00.000Z`;
            return isoStr;
        } catch {
            // stat 失败则忽略
        }
    }

    return '';
}
