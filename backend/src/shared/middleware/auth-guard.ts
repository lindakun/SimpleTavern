import { Request, Response, NextFunction } from 'express';

/**
 * 要求用户已登录的中间件
 * 对应原项目的 requireLoginMiddleware
 */
export function requireLogin(req: Request, res: Response, next: NextFunction): void {
    const session = req.session;
    if (!session?.handle) {
        res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
        return;
    }
    next();
}

/**
 * 要求管理员权限的中间件
 * 对应原项目的 requireAdminMiddleware
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
    const session = req.session;
    if (!session?.handle) {
        res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' });
        return;
    }
    if (!session.admin) {
        res.status(403).json({ code: 'FORBIDDEN', message: 'Admin privileges required' });
        return;
    }
    next();
}
