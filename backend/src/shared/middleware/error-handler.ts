import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

/** csrf-sync / 其他第三方中间件抛出的错误码 → HTTP 状态码 */
const THIRD_PARTY_ERROR_MAP: Record<string, { status: number; logLevel: 'warn' | 'error' }> = {
    EBADCSRFTOKEN: { status: 403, logLevel: 'warn' },
};

export function errorHandler(err: Error & { code?: string }, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            code: err.code,
            message: err.message,
        });
        return;
    }

    // 识别第三方中间件错误（如 csrf-sync 的 EBADCSRFTOKEN）
    if (err.code && THIRD_PARTY_ERROR_MAP[err.code]) {
        const mapped = THIRD_PARTY_ERROR_MAP[err.code];
        if (mapped.logLevel === 'warn') {
            logger.warn(`请求被拒绝: ${err.message} (code: ${err.code})`);
        } else {
            logger.error(`请求被拒绝: ${err.message} (code: ${err.code})`);
        }
        res.status(mapped.status).json({
            code: err.code,
            message: err.message,
        });
        return;
    }

    logger.error('未捕获的服务器错误:', err);
    res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
    });
}
