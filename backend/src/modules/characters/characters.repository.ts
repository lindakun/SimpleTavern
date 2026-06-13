import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';
import { readCharacterCardFromFile, writeCharacterCardToFile } from './characters.parser.js';
import { MemoryLimitedMap } from '../../infrastructure/storage/disk-cache.js';
import { logger } from '../../common/logger.js';

const memoryCache = new MemoryLimitedMap<string>('100mb');

/**
 * 生成角色 PNG 文件的缓存键
 */
function getCacheKey(filePath: string): string {
    if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        return `${filePath}-${stat.mtimeMs}`;
    }
    return filePath;
}

/**
 * 从指定的 PNG 文件中读取角色卡数据（带缓存）
 */
export function readCharacterData(filePath: string): string | undefined {
    const cacheKey = getCacheKey(filePath);
    if (memoryCache.has(cacheKey)) {
        return memoryCache.get(cacheKey);
    }

    try {
        const result = readCharacterCardFromFile(filePath);
        memoryCache.set(cacheKey, result);
        return result;
    } catch {
        // 预期：操作失败，返回 undefined
        return undefined;
    }
}

/**
 * 写入角色卡数据到 PNG 文件
 */
export function writeCharacterData(
    filePath: string,
    data: string,
    imageBuffer?: Buffer,
): boolean {
    try {
        // 清除缓存
        for (const key of memoryCache.keys()) {
            if (key.startsWith(filePath)) {
                memoryCache.delete(key);
                break;
            }
        }
        writeCharacterCardToFile(filePath, data, imageBuffer);
        return true;
    } catch (err) {
        logger.error('写入角色卡失败:', err);
        return false;
    }
}

/**
 * 删除角色 PNG 文件
 */
export function deleteCharacterFile(filePath: string): boolean {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            // 清除相关缓存
            for (const key of memoryCache.keys()) {
                if (key.startsWith(filePath)) {
                    memoryCache.delete(key);
                    break;
                }
            }
            return true;
        }
        return false;
    } catch {
        // 预期：操作失败，返回 false
        return false;
    }
}

/**
 * 列出指定目录下的所有角色 PNG 文件
 */
export function listCharacterFiles(charactersDir: string): string[] {
    if (!fs.existsSync(charactersDir)) {
        return [];
    }
    return fs.readdirSync(charactersDir)
        .filter(f => f.endsWith('.png'))
        .sort();
}

/**
 * 获取角色文件的完整路径
 */
export function getCharacterFilePath(charactersDir: string, fileName: string): string {
    return path.join(charactersDir, sanitize(fileName));
}

/**
 * 获取聊天目录路径（基于角色文件名）
 */
export function getCharacterChatDir(chatsDir: string, characterFileName: string): string {
    const chatDir = path.join(chatsDir, characterFileName.replace('.png', ''));
    return chatDir;
}

/**
 * 检查聊天目录是否存在，不存在则创建
 */
export function ensureChatDir(chatsDir: string, characterFileName: string): string {
    const dir = getCharacterChatDir(chatsDir, characterFileName);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
