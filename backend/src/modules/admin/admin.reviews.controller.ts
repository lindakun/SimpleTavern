import { Request, Response, NextFunction } from 'express';
import {
    deleteReview,
    type ReviewStoreKind,
} from '../characters/reviews.repository.js';
import { deletePublishedReview } from '../characters/admin-characters.controller.js';
import { BadRequestError } from '../../common/errors.js';

const FILE_STORES: ReviewStoreKind[] = ['seed', 'imported', 'png'];

/**
 * DELETE /api/admin/reviews
 * body: { store, characterKey, reviewId }
 * store=published 时 characterKey 格式为 "handle:characterId"
 */
export async function deleteAdminReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { store, characterKey, reviewId } = req.body as {
            store?: string;
            characterKey?: string;
            reviewId?: string;
        };

        if (!store || !characterKey || !reviewId) {
            throw new BadRequestError('Missing required fields: store, characterKey, reviewId');
        }

        if (store === 'published') {
            const [handle, ...rest] = characterKey.split(':');
            const characterId = rest.join(':');
            if (!handle || !characterId) {
                throw new BadRequestError('published characterKey must be "handle:characterId"');
            }
            const ok = await deletePublishedReview(handle, characterId, reviewId);
            if (!ok) {
                res.status(404).json({ code: 'NOT_FOUND', message: 'Review not found' });
                return;
            }
            res.json({ ok: true });
            return;
        }

        if (!FILE_STORES.includes(store as ReviewStoreKind)) {
            throw new BadRequestError('store must be seed | imported | png | published');
        }

        const ok = deleteReview(store as ReviewStoreKind, characterKey, reviewId);
        if (!ok) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Review not found' });
            return;
        }

        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
}
