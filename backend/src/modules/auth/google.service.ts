import { OAuth2Client } from 'google-auth-library';
import { User } from '../../types/models.types.js';
import { getUserByGoogleId, getHandleByGoogleId, saveUser, saveGoogleIdMapping, saveEmailMapping, userExists, createUserDirectories, saveAvatar } from '../users/users.repository.js';
import { slugify, computeAccountVersion } from '../../common/utils.js';
import { UnauthorizedError, ConflictError } from '../../common/errors.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../common/logger.js';

const CLIENT_ID = process.env.SIMPLE_TAVERN_GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

export interface GoogleUserProfile {
    sub: string;       // Google subject id (unique)
    email: string;
    name: string;
    picture?: string;
}

/**
 * 验证 Google ID Token，返回用户 profile
 */
export async function verifyGoogleIdToken(idToken: string): Promise<GoogleUserProfile> {
    if (!CLIENT_ID) {
        throw new UnauthorizedError('Google OAuth is not configured on the server');
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload?.sub || !payload?.email) {
            throw new UnauthorizedError('Invalid Google token payload');
        }

        return {
            sub: payload.sub,
            email: payload.email,
            name: payload.name || payload.email.split('@')[0],
            picture: payload.picture,
        };
    } catch (err) {
        if (err instanceof UnauthorizedError) throw err;
        throw new UnauthorizedError('Google token verification failed');
    }
}

/**
 * 通过 Google profile 查找或创建用户
 */
export async function findOrCreateGoogleUser(profile: GoogleUserProfile): Promise<User> {
    // 1. 先通过 googleId 映射查找
    const existingHandle = await getHandleByGoogleId(profile.sub);
    if (existingHandle) {
        const user = await getUserByGoogleId(profile.sub);
        if (user) return user;
    }

    // 2. 通过邮箱查找已有账号，关联 Google ID
    const emailHandle = await getHandleByEmailDirect(profile.email);
    if (emailHandle) {
        const { getUserByHandle } = await import('../users/users.repository.js');
        const existing = await getUserByHandle(emailHandle);
        if (existing) {
            existing.googleId = profile.sub;
            await saveUser(existing);
            await saveGoogleIdMapping(profile.sub, existing.handle);
            logger.info(`Google 账号关联到已有用户: ${existing.handle}`);
            return existing;
        }
    }

    // 3. 创建新用户
    const baseHandle = slugify(profile.email.split('@')[0]) || 'user';
    let handle = baseHandle;
    let suffix = 1;
    while (await userExists(handle)) {
        handle = `${baseHandle}${suffix++}`;
    }

    const user: User = {
        handle,
        name: profile.name,
        created: Date.now(),
        password: '',
        salt: '',
        enabled: true,
        admin: false,
        googleId: profile.sub,
    };

    await saveUser(user);
    await saveGoogleIdMapping(profile.sub, handle);

    // 保存邮箱映射
    await saveEmailMapping(profile.email, handle);

    // 创建用户目录
    const config = getConfig();
    createUserDirectories(config.dataRoot, handle);

    // 保存 Google 头像
    if (profile.picture) {
        await saveAvatar(handle, profile.picture);
    }

    logger.info(`通过 Google 创建新用户: ${handle}`);
    return user;
}

/**
 * 获取 Google 用户的 session 信息
 */
export function getGoogleLoginResult(user: User) {
    return {
        handle: user.handle,
        version: computeAccountVersion(user.handle, user.password, user.salt),
        admin: user.admin,
    };
}

// 直接通过邮箱映射查找 handle（不走 login 逻辑）
async function getHandleByEmailDirect(email: string): Promise<string | null> {
    const { getHandleByEmail } = await import('../users/users.repository.js');
    return getHandleByEmail(email);
}
