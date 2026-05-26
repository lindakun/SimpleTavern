import crypto from 'node:crypto';

/**
 * 生成密码哈希 — 与原始 SillyTavern 兼容
 */
export function hashPassword(password: string, salt: string): string {
    return crypto.scryptSync(password.normalize(), salt, 64).toString('base64');
}

/**
 * 生成密码盐值
 */
export function generateSalt(): string {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * 计算账号版本（用于会话失效检测）
 * 当用户密码或盐值变更时，版本号变化会清除旧会话
 */
export function computeAccountVersion(handle: string, password: string, salt: string): string {
    return crypto.createHash('shake256', { outputLength: 8 })
        .update(JSON.stringify([handle, password, salt]))
        .digest('hex');
}

/**
 * 将文本转换为 URL 友好的 slug
 */
export function slugify(text: string): string {
    const deburred = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return deburred
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * 生成指定长度的随机十六进制字符串
 */
export function randomHex(length: number): string {
    return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}
