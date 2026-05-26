import { User } from '../../types/models.types.js';
import { hashPassword, generateSalt, computeAccountVersion } from '../../common/utils.js';
import { getUserByHandle, saveUser, getAllUsers, getUserViewModel, getHandleByEmail, saveEmailMapping } from '../users/users.repository.js';
import { BadRequestError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../common/errors.js';

/**
 * 验证用户密码
 */
export function verifyPassword(user: User, password: string): boolean {
    if (!user.password) return true; // 无密码用户验证通过
    const hashed = hashPassword(password, user.salt);
    return hashed === user.password;
}

/**
 * 计算用户的会话版本
 */
export function getAccountVersion(user: User): string {
    return computeAccountVersion(user.handle, user.password, user.salt);
}

export interface LoginResult {
    handle: string;
    version: string;
    admin: boolean;
}

/**
 * 用户登录 — 支持 handle 或邮箱
 */
export async function login(handleOrEmail: string, password?: string): Promise<LoginResult> {
    // 先尝试按 handle 查找
    let user = await getUserByHandle(handleOrEmail);
    // 如果没找到且输入包含 @，尝试按邮箱查找
    if (!user && handleOrEmail.includes('@')) {
        // 1) 精确邮箱匹配
        const mappedHandle = await getHandleByEmail(handleOrEmail);
        if (mappedHandle) {
            user = await getUserByHandle(mappedHandle);
        }
        // 2) 回退：@ 前缀当 handle（兼容旧账号）
        if (!user) {
            const prefix = handleOrEmail.split('@')[0];
            user = await getUserByHandle(prefix);
        }
        // 3) 最后尝试：扫描所有用户名匹配（兼容旧注册）
        if (!user) {
            const all = await getAllUsers();
            user = all.find(u => u.name === handleOrEmail || u.name === handleOrEmail.split('@')[0]) || null;
        }
    }
    if (!user) {
        throw new UnauthorizedError('Incorrect credentials');
    }

    // 登录成功，如有邮箱映射缺失则自动补全（兼容旧账号）
    if (handleOrEmail.includes('@') && !await getHandleByEmail(handleOrEmail)) {
        await saveEmailMapping(handleOrEmail, user.handle).catch(() => {});
    }
    if (!user.enabled) {
        throw new ForbiddenError('User is disabled');
    }
    if (user.password && !password) {
        throw new BadRequestError('Missing required fields');
    }
    if (user.password && !verifyPassword(user, password!)) {
        throw new UnauthorizedError('Incorrect credentials');
    }

    return {
        handle: user.handle,
        version: getAccountVersion(user),
        admin: user.admin,
    };
}

/**
 * 用户注册（经管理员创建）
 */
export async function registerUser(
    handle: string,
    name?: string,
    password?: string,
    admin?: boolean,
): Promise<string> {
    const existing = await getUserByHandle(handle);
    if (existing) {
        throw new Error('User already exists');
    }

    const salt = password ? generateSalt() : '';
    const user: User = {
        handle,
        name: name || handle,
        created: Date.now(),
        password: password ? hashPassword(password, salt) : '',
        salt,
        enabled: true,
        admin: admin || false,
    };

    await saveUser(user);
    return handle;
}

/**
 * 初始化密码恢复（生成 MFA 码）
 * 简化版：返回恢复码（实际应打印到控制台）
 */
export function generateRecoveryCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 更改用户密码
 */
export async function changeUserPassword(
    handle: string,
    newPassword?: string,
    oldPassword?: string,
    isAdmin = false,
): Promise<void> {
    const user = await getUserByHandle(handle);
    if (!user) {
        throw new NotFoundError('User');
    }
    if (!user.enabled) {
        throw new ForbiddenError('User is disabled');
    }

    // 非管理员需要验证旧密码
    if (!isAdmin && user.password) {
        if (!oldPassword || !verifyPassword(user, oldPassword)) {
            throw new UnauthorizedError('Incorrect password');
        }
    }

    if (newPassword) {
        const salt = generateSalt();
        user.password = hashPassword(newPassword, salt);
        user.salt = salt;
    } else {
        user.password = '';
        user.salt = '';
    }

    await saveUser(user);
}

/**
 * 获取用户列表（公开版，只返回启用用户）
 */
export async function getPublicUserList(): Promise<any[]> {
    const users = await getAllUsers();
    const enabled = users.filter(u => u.enabled);
    enabled.sort((a, b) => a.created - b.created);

    const result = [];
    for (const user of enabled) {
        result.push(await getUserViewModel(user));
    }
    return result;
}

/**
 * 获取所有用户列表（管理员版，包含禁用用户）
 */
export async function getAllUsersList(): Promise<any[]> {
    const users = await getAllUsers();
    users.sort((a, b) => a.created - b.created);

    const result = [];
    for (const user of users) {
        const view = await getUserViewModel(user);
        view.enabled = user.enabled;
        result.push(view);
    }
    return result;
}
