/**
 * 请求日志中间件
 *
 * 记录所有 API 请求的路径、方法、状态码和响应时间
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../../common/logger.js';

/**
 * 请求日志中间件
 * 记录：HTTP 方法、路径、状态码、响应时间
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
    const startTime = Date.now();

    // 响应完成时记录日志
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const { method, path } = req;
        const statusCode = res.statusCode;

        // 根据状态码选择日志级别
        if (statusCode >= 500) {
            logger.error(`${method} ${path} ${statusCode} ${duration}ms`);
        } else if (statusCode >= 400) {
            logger.warn(`${method} ${path} ${statusCode} ${duration}ms`);
        } else if (process.env.LOG_LEVEL === 'debug') {
            logger.debug(`${method} ${path} ${statusCode} ${duration}ms`);
        } else {
            logger.info(`${method} ${path} ${statusCode} ${duration}ms`);
        }
    });

    next();
}
