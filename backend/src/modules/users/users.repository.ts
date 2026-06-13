import path from 'node:path';
import fs from 'node:fs';
import storage from 'node-persist';
import { User, UserDirectoryList } from '../../types/models.types.js';
import { logger } from '../../common/logger.js';

let initialized = false;

export async function initUserStorage(dataRoot: string): Promise<void> {
    if (initialized) return;

    const storageDir = path.join(dataRoot, '_storage');
    await storage.init({
        dir: storageDir,
        ttl: false,
        expiredInterval: 0,
    });
    initialized = true;

    // 检查是否有默认用户，没有则创建
    const keys = await storage.keys();
    const userKeys = keys.filter((k: string) => k.startsWith('user:'));
    if (userKeys.length === 0) {
        const defaultUser: User = {
            handle: 'default-user',
            name: 'User',
            created: Date.now(),
            password: '',
            salt: '',
            enabled: true,
            admin: true,
        };
        await saveUser(defaultUser);
        logger.info('已创建默认用户: default-user');
    }
}

async function ensureInitialized(): Promise<void> {
    if (!initialized) {
        throw new Error('User storage not initialized. Call initUserStorage() first.');
    }
}

export async function getUserByHandle(handle: string): Promise<User | null> {
    await ensureInitialized();
    try {
        const user = await storage.getItem(`user:${handle}`);
        return user || null;
    } catch {
        // 预期：存储操作失败，返回 null
        return null;
    }
}

export async function getAllUsers(): Promise<User[]> {
    await ensureInitialized();
    try {
        const keys = await storage.keys();
        const userKeys = keys.filter((k: string) => k.startsWith('user:'));
        const users: User[] = [];
        for (const key of userKeys) {
            const user = await storage.getItem(key);
            if (user) users.push(user);
        }
        return users;
    } catch {
        // 预期：存储操作失败，返回空数组
        return [];
    }
}

export async function saveEmailMapping(email: string, handle: string): Promise<void> {
    await ensureInitialized();
    await storage.setItem(`email:${email.toLowerCase().trim()}`, handle);
}

export async function getHandleByEmail(email: string): Promise<string | null> {
    await ensureInitialized();
    try {
        const handle = await storage.getItem(`email:${email.toLowerCase().trim()}`);
        return handle || null;
    } catch {
        // 预期：存储操作失败，返回 null
        return null;
    }
}

export async function getUserByGoogleId(googleId: string): Promise<User | null> {
    await ensureInitialized();
    try {
        const keys = await storage.keys();
        const userKeys = keys.filter((k: string) => k.startsWith('user:'));
        for (const key of userKeys) {
            const user: User = await storage.getItem(key);
            if (user && user.googleId === googleId) {
                return user;
            }
        }
        return null;
    } catch {
        // 预期：存储操作失败，返回 null
        return null;
    }
}

export async function saveUser(user: User): Promise<void> {
    await ensureInitialized();
    await storage.setItem(`user:${user.handle}`, user);
}

export async function deleteUser(handle: string): Promise<void> {
    await ensureInitialized();
    await storage.removeItem(`user:${handle}`);
    await storage.removeItem(`avatar:${handle}`);
}

export async function getAvatar(handle: string): Promise<string | null> {
    await ensureInitialized();
    try {
        const avatar = await storage.getItem(`avatar:${handle}`);
        return avatar || null;
    } catch {
        // 预期：存储操作失败，返回 null
        return null;
    }
}

export async function saveAvatar(handle: string, avatarData: string): Promise<void> {
    await ensureInitialized();
    await storage.setItem(`avatar:${handle}`, avatarData);
}

export async function deleteAvatar(handle: string): Promise<void> {
    await ensureInitialized();
    await storage.removeItem(`avatar:${handle}`);
}

/**
 * 获取用户的格式化视图（用于 API 响应）
 */
export async function getUserViewModel(user: User): Promise<{
    handle: string;
    name: string;
    created: number;
    avatar: string;
    admin: boolean;
    password: boolean;
    enabled?: boolean;
}> {
    const avatar = await getAvatar(user.handle);
    return {
        handle: user.handle,
        name: user.name,
        created: user.created,
        avatar: avatar || '/img/default-user.png',
        admin: user.admin,
        password: user.password !== '',
    };
}

/**
 * 构造用户的目录列表
 */
export function getUserDirectories(dataRoot: string, handle: string): UserDirectoryList {
    const base = path.join(dataRoot, handle);
    return {
        root: base,
        thumbnails: path.join(base, 'thumbnails'),
        worlds: path.join(base, 'worlds'),
        user: path.join(base, 'user'),
        avatars: path.join(base, 'User Avatars'),
        userImages: path.join(base, 'user', 'images'),
        groups: path.join(base, 'groups'),
        chats: path.join(base, 'chats'),
        characters: path.join(base, 'characters'),
        backgrounds: path.join(base, 'backgrounds'),
    };
}

/**
 * 创建用户的文件目录结构
 */
export function createUserDirectories(dataRoot: string, handle: string): void {
    const dirs = getUserDirectories(dataRoot, handle);
    for (const [, dirPath] of Object.entries(dirs)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

/**
 * 删除用户的文件目录结构
 */
export function removeUserDirectories(dataRoot: string, handle: string): void {
    const dirs = getUserDirectories(dataRoot, handle);
    if (fs.existsSync(dirs.root)) {
        fs.rmSync(dirs.root, { recursive: true, force: true });
    }
}

/**
 * 检查用户是否已存在
 */
export async function userExists(handle: string): Promise<boolean> {
    const user = await getUserByHandle(handle);
    return user !== null;
}

/**
 * 保存 Google ID → handle 映射
 */
export async function saveGoogleIdMapping(googleId: string, handle: string): Promise<void> {
    await ensureInitialized();
    await storage.setItem(`google:${googleId}`, handle);
}

/**
 * 通过 Google ID 映射获取 handle
 */
export async function getHandleByGoogleId(googleId: string): Promise<string | null> {
    await ensureInitialized();
    try {
        const handle = await storage.getItem(`google:${googleId}`);
        return handle || null;
    } catch {
        // 预期：存储操作失败，返回 null
        return null;
    }
}
