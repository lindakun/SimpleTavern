import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { importCharacterFile } from './characters.importer.js';
import { getConfig } from '../../config/index.js';
import { getUserDirectories } from '../users/users.repository.js';
import { BadRequestError } from '../../common/errors.js';
import { logger } from '../../common/logger.js';

function getHandle(req: any): string | null {
    return req.session?.handle || null;
}

export function createPublicImportRoutes(): Router {
    const router = Router();

    const config = getConfig();
    const upload = multer({ dest: path.join(config.dataRoot, 'uploads') });

    router.post('/characters/import', upload.single('file'), async (req, res, next) => {
        try {
            const file = (req as any).file;
            if (!file) throw new BadRequestError('No file uploaded');

            const handle = getHandle(req);
            if (!handle) { res.status(401).json({ code: 'UNAUTHORIZED', message: 'You must be logged in' }); return; }
            const dirs = getUserDirectories(config.dataRoot, handle);

            // 确保 characters 目录存在
            if (!fs.existsSync(dirs.characters)) {
                fs.mkdirSync(dirs.characters, { recursive: true });
            }

            const pngName = await importCharacterFile(file.path, file.originalname, dirs.characters);
            logger.info(`用户 ${handle} 导入角色: ${pngName}`);
            res.json({ path: pngName });
        } catch (err: any) {
            next(err);
        }
    });

    return router;
}
