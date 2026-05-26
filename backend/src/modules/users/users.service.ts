import storage from 'node-persist';

/**
 * 获取用户的收藏列表
 */
export async function getUserFavorites(handle: string): Promise<string[]> {
    try {
        const favorites = await storage.getItem(`favorites:${handle}`);
        return Array.isArray(favorites) ? favorites : [];
    } catch {
        return [];
    }
}

/**
 * 添加收藏
 */
export async function addFavorite(handle: string, characterId: string): Promise<string[]> {
    const favorites = await getUserFavorites(handle);
    if (!favorites.includes(characterId)) {
        favorites.push(characterId);
        await storage.setItem(`favorites:${handle}`, favorites);
    }
    return favorites;
}

/**
 * 取消收藏
 */
export async function removeFavorite(handle: string, characterId: string): Promise<string[]> {
    const favorites = await getUserFavorites(handle);
    const updated = favorites.filter((id: string) => id !== characterId);
    await storage.setItem(`favorites:${handle}`, updated);
    return updated;
}

export interface UserSettings {
    cloudBackup?: boolean;
    autoPlayAudio?: boolean;
    renderQuality?: 'high' | 'medium' | 'low';
    [key: string]: unknown;
}

/**
 * 获取用户设置
 */
export async function getUserSettings(handle: string): Promise<UserSettings> {
    try {
        const settings = await storage.getItem(`settings:${handle}`);
        return (settings && typeof settings === 'object') ? settings as UserSettings : {};
    } catch {
        return {};
    }
}

/**
 * 保存用户设置
 */
export async function saveUserSettings(handle: string, settings: UserSettings): Promise<void> {
    await storage.setItem(`settings:${handle}`, settings);
}
