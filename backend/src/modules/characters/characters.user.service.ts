import storage from 'node-persist';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../common/logger.js';

interface UserCharacter {
    id: string;
    name: string;
    avatar: string;
    creator: string;
    createdAt: string;
    rating: number;
    reviewCount: number;
    status: 'online' | 'private' | 'draft';
    tags: string[];

    // V3 角色卡 data 字段
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    character_version: string;
    extensions: Record<string, unknown>;

    // 兼容旧字段
    tagline?: string;
    worldBook?: string;
    voiceType?: 'sweet' | 'mature';
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
        description?: string;
        personality?: string;
        scenario?: string;
        first_mes?: string;
        mes_example?: string;
        creator_notes?: string;
        system_prompt?: string;
        post_history_instructions?: string;
        alternate_greetings?: string[];
        tags?: string[];
        creator?: string;
        character_version?: string;
        avatar?: string;
        // 兼容旧字段
        tagline?: string;
        worldBook?: string;
        voiceType?: 'sweet' | 'mature';
    },
): Promise<UserCharacter> {
    const id = `custom_${uuidv4().slice(0, 8)}`;
    const character: UserCharacter = {
        id,
        name: data.name,
        avatar: data.avatar || '',
        creator: data.creator || handle,
        createdAt: new Date().toISOString(),
        rating: 0,
        reviewCount: 0,
        status: 'online',
        tags: data.tags || [],

        // V3 字段
        description: data.description || '',
        personality: data.personality || '',
        scenario: data.scenario || '',
        first_mes: data.first_mes || '',
        mes_example: data.mes_example || '',
        creator_notes: data.creator_notes || '',
        system_prompt: data.system_prompt || '',
        post_history_instructions: data.post_history_instructions || '',
        alternate_greetings: data.alternate_greetings || [],
        character_version: data.character_version || '1.0',
        extensions: {},

        // 兼容旧字段
        tagline: data.tagline,
        worldBook: data.worldBook,
        voiceType: data.voiceType,
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
 * 更新用户发布角色
 */
export async function updateUserCharacter(
    handle: string,
    characterId: string,
    data: Partial<Omit<UserCharacter, 'id' | 'creator' | 'createdAt'>>,
): Promise<UserCharacter | null> {
    try {
        const key = `userchar:${handle}:${characterId}`;
        const existing = await storage.getItem(key) as UserCharacter | undefined;
        if (!existing) return null;

        const updated: UserCharacter = {
            ...existing,
            name: data.name ?? existing.name,
            avatar: data.avatar ?? existing.avatar,
            tags: data.tags ?? existing.tags,
            rating: data.rating ?? existing.rating,
            reviewCount: data.reviewCount ?? existing.reviewCount,
            status: data.status ?? existing.status,

            // V3 字段
            description: data.description ?? existing.description,
            personality: data.personality ?? existing.personality,
            scenario: data.scenario ?? existing.scenario,
            first_mes: data.first_mes ?? existing.first_mes,
            mes_example: data.mes_example ?? existing.mes_example,
            creator_notes: data.creator_notes ?? existing.creator_notes,
            system_prompt: data.system_prompt ?? existing.system_prompt,
            post_history_instructions: data.post_history_instructions ?? existing.post_history_instructions,
            alternate_greetings: data.alternate_greetings ?? existing.alternate_greetings,
            character_version: data.character_version ?? existing.character_version,
            extensions: data.extensions ?? existing.extensions,

            // 兼容旧字段
            tagline: data.tagline ?? existing.tagline,
            worldBook: data.worldBook ?? existing.worldBook,
            voiceType: data.voiceType ?? existing.voiceType,
        };

        await storage.setItem(key, updated);
        logger.info(`用户 ${handle} 更新了角色: ${updated.name} (${characterId})`);
        return updated;
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
