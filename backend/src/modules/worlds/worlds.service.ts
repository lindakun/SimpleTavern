import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';
import { AdminWorldItem, WorldInfo } from './types.js';
import { logger } from '../../common/logger.js';

/**
 * 获取世界书全局目录路径
 */
export function getWorldsDir(dataRoot: string): string {
    return path.join(dataRoot, 'worlds');
}

/**
 * 文件名校验，防止路径穿越
 */
export function sanitizeWorldName(name: string): string {
    const sanitized = sanitize(name);
    const filename = `${sanitized}.json`;
    // 确保结果安全
    if (filename !== sanitize(filename) || !filename || filename === '.json') {
        throw new Error(`Invalid world name: ${name}`);
    }
    return filename;
}

/**
 * 扫描世界书目录，返回所有世界书列表
 */
export function listWorlds(dataRoot: string): AdminWorldItem[] {
    const worldsDir = getWorldsDir(dataRoot);

    if (!fs.existsSync(worldsDir)) {
        return [];
    }

    const files = fs.readdirSync(worldsDir, { withFileTypes: true })
        .filter((f) => f.isFile() && path.extname(f.name).toLowerCase() === '.json')
        .sort((a, b) => a.name.localeCompare(b.name));

    const results: AdminWorldItem[] = [];

    for (const file of files) {
        try {
            const filePath = path.join(worldsDir, file.name);
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw) as WorldInfo;
            const entries = parsed.entries || {};
            const entriesCount = Object.keys(entries).length;

            results.push({
                file_id: path.parse(file.name).name,
                name: parsed.name || path.parse(file.name).name,
                entriesCount,
                extensions: (parsed.extensions && typeof parsed.extensions === 'object') ? parsed.extensions : {},
            });
        } catch (err) {
            // 跳过无法解析的文件
            logger.warn(`[worlds] 跳过无法读取的世界书文件: ${file.name}`, (err as Error).message);
        }
    }

    return results;
}

/**
 * 读取指定世界书的内容
 */
export function getWorld(dataRoot: string, name: string): WorldInfo | null {
    const worldsDir = getWorldsDir(dataRoot);
    const filename = sanitizeWorldName(name);
    const filePath = path.join(worldsDir, filename);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as WorldInfo;
}

/**
 * 保存世界书（新建或覆写）
 */
export function saveWorld(dataRoot: string, name: string, data: WorldInfo): void {
    if (!data || !('entries' in data)) {
        throw new Error('世界书数据必须包含 entries 字段');
    }

    const worldsDir = getWorldsDir(dataRoot);

    // 确保目录存在
    if (!fs.existsSync(worldsDir)) {
        fs.mkdirSync(worldsDir, { recursive: true });
    }

    const filename = sanitizeWorldName(name);
    const filePath = path.join(worldsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf-8');
}

/**
 * 删除世界书
 */
export function deleteWorld(dataRoot: string, name: string): boolean {
    const worldsDir = getWorldsDir(dataRoot);
    const filename = sanitizeWorldName(name);
    const filePath = path.join(worldsDir, filename);

    if (!fs.existsSync(filePath)) {
        return false;
    }

    fs.unlinkSync(filePath);
    return true;
}
