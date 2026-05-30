import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';

/**
 * 读取聊天文件（JSONL 格式，每行一个 JSON 对象）
 */
export function readChatFile(filePath: string): any[] {
    try {
        if (!fs.existsSync(filePath)) {
            return [];
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content) return [];

        return content
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
    } catch {
        return [];
    }
}

/**
 * 写入聊天文件（JSONL 格式）
 */
export function writeChatFile(filePath: string, chatData: any[]): void {
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
            .sort();
    } catch {
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
