import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '../../config/index.js';
import { getAllUsers } from '../users/users.repository.js';
import { getSeedCharacters } from '../characters/seed.service.js';
import { getUserCharacters } from '../characters/characters.user.service.js';
import { getUserDirectories } from '../users/users.repository.js';

interface AdminStats {
    users: {
        total: number;
        enabled: number;
        admins: number;
        createdLast7d: number;
    };
    characters: {
        seed: number;
        publishedPublic: number;
        publishedPrivate: number;
        filePng: number;
    };
    chats: {
        fileCount: number;
    };
    system: {
        version: string;
        dataRoot: string;
        uptimeSec: number;
    };
}

let statsCache: { expiresAt: number; data: AdminStats } | null = null;
const STATS_CACHE_TTL_MS = 45_000;

function countJsonlFiles(dir: string): number {
    if (!fs.existsSync(dir)) return 0;
    let count = 0;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                count += countJsonlFiles(full);
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                count += 1;
            }
        }
    } catch {
        // 忽略不可读目录
    }
    return count;
}

function countPngCharacters(charactersDir: string): number {
    if (!fs.existsSync(charactersDir)) return 0;
    try {
        return fs.readdirSync(charactersDir).filter((f) => f.endsWith('.png')).length;
    } catch {
        return 0;
    }
}

/**
 * GET /api/admin/stats
 */
export async function getAdminStats(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const now = Date.now();
        if (statsCache && statsCache.expiresAt > now) {
            res.json(statsCache.data);
            return;
        }

        const config = getConfig();
        const users = await getAllUsers();
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

        let publishedPublic = 0;
        let publishedPrivate = 0;
        let filePng = 0;
        let chatFileCount = 0;

        for (const user of users) {
            const chars = await getUserCharacters(user.handle);
            for (const c of chars) {
                if (c.privacyType === 'public' && c.status !== 'draft') {
                    publishedPublic += 1;
                } else {
                    publishedPrivate += 1;
                }
            }

            const dirs = getUserDirectories(config.dataRoot, user.handle);
            filePng += countPngCharacters(dirs.characters);
            chatFileCount += countJsonlFiles(dirs.chats);
        }

        const seed = getSeedCharacters().length;

        const data: AdminStats = {
            users: {
                total: users.length,
                enabled: users.filter((u) => u.enabled !== false).length,
                admins: users.filter((u) => u.admin).length,
                createdLast7d: users.filter((u) => (u.created || 0) >= weekAgo).length,
            },
            characters: {
                seed,
                publishedPublic,
                publishedPrivate,
                filePng,
            },
            chats: {
                fileCount: chatFileCount,
            },
            system: {
                version: '0.1.0',
                dataRoot: config.dataRoot,
                uptimeSec: Math.floor(process.uptime()),
            },
        };

        statsCache = { expiresAt: now + STATS_CACHE_TTL_MS, data };
        res.json(data);
    } catch (err) {
        next(err);
    }
}

/** 供写操作后主动失效缓存 */
export function invalidateAdminStatsCache(): void {
    statsCache = null;
}
