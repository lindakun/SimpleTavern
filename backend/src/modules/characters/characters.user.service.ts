import storage from 'node-persist';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger.js';

interface UserCharacter {
    id: string;
    name: string;
    avatar: string;
    tagline: string;
    description: string;
    worldBook: string;
    tags: string[];
    voiceType: 'sweet' | 'mature';
    creator: string;
    createdAt: string;
    rating: number;
    reviewCount: number;
    status: 'online' | 'private' | 'draft';
}

/**
 * 列出用户创建的角色
 */
export async function getUserCharacters(handle: string): Promise<UserCharacter[]> {
    try {
        const keys = await storage.keys();
        const prefix = `userchar:${handle}:`;
        const chars: UserCharacter[] = [];
        for (const key of keys) {
            if (key.startsWith(prefix)) {
                const char = await storage.getItem(key);
                if (char) chars.push(char);
            }
        }
        return chars;
    } catch {
        return [];
    }
}

/**
 * 创建角色
 */
export async function publishCharacter(
    handle: string,
    data: {
        name: string;
        tagline?: string;
        description?: string;
        worldBook?: string;
        tags?: string[];
        voiceType?: 'sweet' | 'mature';
        avatar?: string;
    },
): Promise<UserCharacter> {
    const id = `custom_${uuidv4().slice(0, 8)}`;
    const character: UserCharacter = {
        id,
        name: data.name,
        avatar: data.avatar || '',
        tagline: data.tagline || '',
        description: data.description || '',
        worldBook: data.worldBook || '',
        tags: data.tags || [],
        voiceType: data.voiceType || 'sweet',
        creator: handle,
        createdAt: new Date().toISOString(),
        rating: 0,
        reviewCount: 0,
        status: 'online',
    };

    await storage.setItem(`userchar:${handle}:${id}`, character);
    logger.info(`用户 ${handle} 创建了角色: ${character.name} (${id})`);
    return character;
}

/**
 * 获取单个用户角色
 */
export async function getUserCharacter(handle: string, characterId: string): Promise<UserCharacter | null> {
    try {
        const char = await storage.getItem(`userchar:${handle}:${characterId}`);
        return char || null;
    } catch {
        return null;
    }
}

/**
 * 删除用户发布角色
 */
export async function deleteUserCharacter(handle: string, characterId: string): Promise<boolean> {
    try {
        const key = `userchar:${handle}:${characterId}`;
        const exists = await storage.getItem(key);
        if (!exists) return false;
        await storage.removeItem(key);
        return true;
    } catch {
        return false;
    }
}
