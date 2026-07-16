import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';
import type { Chat } from './types.js';

/**
 * 读取聊天文件（JSONL 格式，每行一个 JSON 对象）
 * 返回 Chat 类型：[ChatHeader, ...ChatMessage[]]
 */
export function readChatFile(filePath: string): Chat {
    try {
        if (!fs.existsSync(filePath)) {
            return [{ chat_metadata: {}, user_name: '', character_name: '' }];
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content) return [{ chat_metadata: {}, user_name: '', character_name: '' }];

        const lines = content
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    // 预期：操作失败，返回 null
                    return null;
                }
            })
            .filter(x => x !== null);

        // 转换为 Chat 类型：第一行是 header，其余是 messages
        if (lines.length === 0) {
            return [{ chat_metadata: {}, user_name: '', character_name: '' }];
        }
        return lines as Chat;
    } catch {
        // 预期：操作失败，返回空数组
        return [{ chat_metadata: {}, user_name: '', character_name: '' }];
    }
}

/** 分页读取结果（含 hasMore 元信息） */
export interface ChatPageResult {
    chat: Chat;
    totalMessages: number;
    hasMore: boolean;
    offset: number;
    limit: number;
}

/**
 * 分页读取聊天文件（JSONL 格式）
 * offset 表示从末尾已跳过的消息数；limit 为本次取条数
 */
export function readChatFilePage(
    filePath: string,
    options?: {
        limit?: number;
        /** 从末尾开始跳过的消息数 */
        offset?: number;
    },
): ChatPageResult {
    const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
    const offset = Math.max(options?.offset ?? 0, 0);
    const emptyHeader = { chat_metadata: {}, user_name: '', character_name: '' };

    try {
        if (!fs.existsSync(filePath)) {
            return { chat: [emptyHeader], totalMessages: 0, hasMore: false, offset, limit };
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content) {
            return { chat: [emptyHeader], totalMessages: 0, hasMore: false, offset, limit };
        }

        const allLines = content
            .split('\n')
            .filter(line => line.trim())
            .map(line => {
                try {
                    return JSON.parse(line);
                } catch {
                    return null;
                }
            })
            .filter(x => x !== null);

        if (allLines.length === 0) {
            return { chat: [emptyHeader], totalMessages: 0, hasMore: false, offset, limit };
        }

        const header = allLines[0];
        const allMessages = allLines.slice(1);
        const totalMessages = allMessages.length;
        const startIndex = Math.max(0, totalMessages - offset - limit);
        const endIndex = Math.max(0, totalMessages - offset);
        const messages = allMessages.slice(startIndex, endIndex);
        const hasMore = startIndex > 0;

        return {
            chat: [header, ...messages] as Chat,
            totalMessages,
            hasMore,
            offset,
            limit,
        };
    } catch {
        return { chat: [emptyHeader], totalMessages: 0, hasMore: false, offset, limit };
    }
}

/**
 * 兼容旧接口：仅返回 Chat 数组
 */
export function readChatFilePaginated(
    filePath: string,
    options?: {
        initialLimit?: number;
        pageSize?: number;
        offset?: number;
    },
): Chat {
    const limit = options?.initialLimit ?? options?.pageSize ?? 50;
    return readChatFilePage(filePath, { limit, offset: options?.offset ?? 0 }).chat;
}

/**
 * 获取聊天文件的总行数（包括 header）
 */
export function getChatFileLineCount(filePath: string): number {
    try {
        if (!fs.existsSync(filePath)) return 0;
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content) return 0;
        return content.split('\n').filter(line => line.trim()).length;
    } catch {
        return 0;
    }
}

/**
 * 写入聊天文件（JSONL 格式）
 */
export function writeChatFile(filePath: string, chatData: Chat): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const jsonlData = chatData.map(m => JSON.stringify(m)).join('\n');
    fs.writeFileSync(filePath, jsonlData, 'utf-8');
}

/**
 * 删除聊天文件
 */
export function deleteChatFile(filePath: string): boolean {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return true;
        }
        return false;
    } catch {
        // 预期：操作失败，返回 false
        return false;
    }
}

/**
 * 批量删除聊天文件
 */
export function batchDeleteChatFiles(filePaths: string[]): number {
    let deleted = 0;
    for (const filePath of filePaths) {
        if (deleteChatFile(filePath)) {
            deleted++;
        }
    }
    return deleted;
}

/**
 * 列出指定目录下的所有聊天文件
 */
export function listChatFiles(directory: string): string[] {
    try {
        if (!fs.existsSync(directory)) {
            return [];
        }
        return fs.readdirSync(directory)
            .filter(f => f.endsWith('.jsonl'))
            .sort((a, b) => {
                // 按修改时间升序，末尾为最新
                try {
                    const sa = fs.statSync(path.join(directory, a)).mtimeMs;
                    const sb = fs.statSync(path.join(directory, b)).mtimeMs;
                    return sa - sb;
                } catch {
                    return a.localeCompare(b);
                }
            });
    } catch {
        // 预期：操作失败，返回空数组
        return [];
    }
}

/**
 * 获取聊天文件的完整路径
 */
export function getChatFilePath(chatsDir: string, characterDir: string, fileName: string): string {
    const dir = path.join(chatsDir, sanitize(characterDir));
    const safeFileName = sanitize(fileName);
    if (!safeFileName.endsWith('.jsonl')) {
        return path.join(dir, `${safeFileName}.jsonl`);
    }
    return path.join(dir, safeFileName);
}

/**
 * 获取角色聊天目录
 */
export function getCharacterChatDir(chatsDir: string, characterName: string): string {
    return path.join(chatsDir, sanitize(characterName.replace('.png', '')));
}

/**
 * 检查文件路径是否受父目录保护
 */
export function isPathUnderParent(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
}

/**
 * 读取聊天文件的第一行
 */
export function readFirstLine(filePath: string): string | null {
    try {
        if (!fs.existsSync(filePath)) return null;
        const content = fs.readFileSync(filePath, 'utf-8');
        const firstNewline = content.indexOf('\n');
        if (firstNewline === -1) return content;
        return content.slice(0, firstNewline);
    } catch {
        // 预期：操作失败，返回 null
        return null;
    }
}

/**
 * 读取置顶列表（用户维度，存储在 chatsDir/pinned.json）
 */
export function readPinnedList(chatsDir: string): string[] {
    const filePath = path.join(chatsDir, 'pinned.json');
    try {
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);
        return Array.isArray(data) ? data : [];
    } catch {
        // 预期：操作失败，返回空数组
        return [];
    }
}

/**
 * 写入置顶列表
 */
export function writePinnedList(chatsDir: string, pinnedIds: string[]): void {
    const filePath = path.join(chatsDir, 'pinned.json');
    if (!fs.existsSync(chatsDir)) {
        fs.mkdirSync(chatsDir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(pinnedIds), 'utf-8');
}
