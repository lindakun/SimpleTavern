/**
 * 请求 ID 中间件
 *
 * 为每个请求生成唯一标识，便于日志追踪和调试
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';

/**
 * 生成请求 ID
 * 格式：req-{timestamp}-{random}
 */
function generateRequestId(): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(4).toString('hex');
    return `req-${timestamp}-${random}`;
}

/**
 * 请求 ID 中间件
 * 为每个请求生成唯一标识，并添加到请求头和响应头中
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    // 优先使用客户端提供的请求 ID（用于分布式追踪）
    const clientRequestId = req.headers['x-request-id'] as string | undefined;
    const requestId = clientRequestId ?? generateRequestId();

    // 添加到请求对象
    (req as Request & { requestId: string }).requestId = requestId;

    // 添加到响应头
    res.setHeader('X-Request-Id', requestId);

    next();
}

/**
 * 获取当前请求的 ID
 */
export function getRequestId(req: Request): string | undefined {
    return (req as Request & { requestId?: string }).requestId;
}
