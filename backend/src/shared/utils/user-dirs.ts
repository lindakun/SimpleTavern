/**
 * 用户目录工具函数
 *
 * 提供类型安全的用户目录路径获取功能
 */

import { Request } from 'express';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../../modules/users/users.repository.js';
import { UnauthorizedError } from '../../common/errors.js';
import type { UserDirectoryList } from '../../types/models.types.js';

/**
 * 获取当前登录用户的目录列表
 *
 * @param req Express 请求对象
 * @returns 用户目录列表
 * @throws UnauthorizedError 如果用户未登录
 */
export function getUserDirs(req: Request): UserDirectoryList {
    const handle = req.session?.handle;
    if (!handle) {
        throw new UnauthorizedError('You must be logged in');
    }
    const config = getConfig();
    return getUserDirectories(config.dataRoot, handle);
}

/**
 * 获取当前登录用户的 handle
 *
 * @param req Express 请求对象
 * @returns 用户 handle 或 null
 */
export function getSessionHandle(req: Request): string | null {
    return req.session?.handle || null;
}
