import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { adminGetAllCharacters, adminDeleteCharacter, adminEditCharacter, adminDeletePublishedCharacter, adminImportUgirl } from './admin-characters.controller.js';
import { getConfig } from '../../config/index.js';

export function createAdminCharacterRoutes(): Router {
    const router = Router();

    // 获取所有用户的所有角色（支持按 handle 过滤）
    router.post('/admin-all', adminGetAllCharacters);

    // 删除指定用户的文件角色
    router.post('/admin-delete', adminDeleteCharacter);

    // 编辑指定用户的文件角色
    router.post('/admin-edit', adminEditCharacter);

    // 删除指定用户的发布角色
    router.post('/admin-delete-published', adminDeletePublishedCharacter);

    // 批量导入 ugirl 角色（文件上传）
    const config = getConfig();
    const upload = multer({ dest: path.join(config.dataRoot, 'uploads') });
    router.post('/admin-import-ugirl', upload.single('file'), adminImportUgirl);

    return router;
}
