import { Router } from 'express';
import { adminGetAllCharacters, adminDeleteCharacter, adminEditCharacter, adminDeletePublishedCharacter, adminImportUgirl } from './admin-characters.controller.js';

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

    // 批量导入 ugirl 角色（接收服务器文件路径）
    router.post('/admin-import-ugirl', adminImportUgirl);

    return router;
}
