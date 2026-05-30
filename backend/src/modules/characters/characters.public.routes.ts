import { Router } from 'express';
import * as characterController from './characters.controller.js';
import * as userCharacterService from './characters.user.service.js';
import { BadRequestError } from '../../common/errors.js';

function getHandle(req: any): string | null {
    return req.session?.handle || null;
}

export function createPublicCharacterRoutes(): Router {
    const router = Router();

    router.post('/characters/publish', characterController.publishCharacter);

    router.get('/users/characters', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.json([]); return; }
            const characters = await userCharacterService.getUserCharacters(handle);
            res.json(characters);
        } catch (err) {
            next(err);
        }
    });

    router.post('/users/characters/edit', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            const characterId = String(req.body.id || req.body.characterId || '');
            if (!characterId) throw new BadRequestError('characterId is required');

            const updated = await userCharacterService.updateUserCharacter(handle, characterId, {
                name: req.body.name,
                avatar: req.body.avatar,
                tagline: req.body.tagline,
                description: req.body.description,
                worldBook: req.body.worldBook,
                tags: req.body.tags,
                voiceType: req.body.voiceType,
                rating: req.body.rating,
                reviewCount: req.body.reviewCount,
                status: req.body.status,
            });

            if (!updated) {
                res.status(404).json({ error: 'Character not found' });
                return;
            }

            res.json(updated);
        } catch (err) {
            next(err);
        }
    });

    router.post('/users/characters/delete', async (req, res, next) => {
        try {
            const handle = getHandle(req);
            if (!handle) { res.status(403).json({ error: 'Unauthorized' }); return; }

            const characterId = String(req.body.id || req.body.characterId || '');
            if (!characterId) throw new BadRequestError('characterId is required');

            const deleted = await userCharacterService.deleteUserCharacter(handle, characterId);
            if (!deleted) {
                res.status(404).json({ error: 'Character not found' });
                return;
            }

            res.json({ ok: true });
        } catch (err) {
            next(err);
        }
    });

    return router;
}
