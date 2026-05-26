import { Router } from 'express';
import * as characterController from './characters.controller.js';
import * as userCharacterService from './characters.user.service.js';

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

    return router;
}
