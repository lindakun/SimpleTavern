import { Request, Response, NextFunction } from 'express';
import * as userService from './users.service.js';
import { BadRequestError } from '../../common/errors.js';

function getHandle(req: Request): string | null {
    const session = req.session as Record<string, any> | null;
    return session?.handle || null;
}

/**
 * GET /api/users/favorites
 */
export async function getFavorites(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const handle = getHandle(req);
        if (!handle) { res.json({ favorites: [] }); return; }
        const favorites = await userService.getUserFavorites(handle);
        res.json({ favorites });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/favorites
 */
export async function addFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const handle = getHandle(req);
        if (!handle) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' }); return; }
        const { characterId } = req.body;
        if (!characterId) throw new BadRequestError('characterId is required');

        const favorites = await userService.addFavorite(handle, characterId);
        res.json({ favorites });
    } catch (err) {
        next(err);
    }
}

/**
 * DELETE /api/users/favorites/:characterId
 */
export async function removeFavorite(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const handle = getHandle(req);
        if (!handle) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' }); return; }
        const { characterId } = req.params;
        if (!characterId) throw new BadRequestError('characterId is required');

        const favorites = await userService.removeFavorite(handle, characterId);
        res.json({ favorites });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/settings — 保存设置
 */
export async function saveSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const handle = getHandle(req);
        if (!handle) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' }); return; }
        const { settings } = req.body;
        if (!settings) throw new BadRequestError('settings is required');

        await userService.saveUserSettings(handle, settings);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/users/settings — 获取设置
 */
export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const handle = getHandle(req);
        if (!handle) { res.json({ settings: {} }); return; }
        const settings = await userService.getUserSettings(handle);
        res.json({ settings });
    } catch (err) {
        next(err);
    }
}
