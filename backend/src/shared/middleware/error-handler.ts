import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.code,
            message: err.message,
        });
        return;
    }

    logger.error('未捕获的错误:', err);
    res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
    });
}
