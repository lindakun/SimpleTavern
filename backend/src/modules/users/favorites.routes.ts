import { Router } from 'express';
import * as favoritesController from './favorites.controller.js';

export function createFavoritesRoutes(): Router {
    const router = Router();

    router.get('/users/favorites', favoritesController.getFavorites);
    router.post('/users/favorites', favoritesController.addFavorite);
    router.delete('/users/favorites/:characterId', favoritesController.removeFavorite);
    router.get('/users/settings', favoritesController.getSettings);
    router.post('/users/settings', favoritesController.saveSettings);

    return router;
}
