import { Router } from 'express';
import { ServerConfig } from '../../types/config.types.js';
import * as authController from './auth.controller.js';
import { requireLogin, requireAdmin } from '../../shared/middleware/auth-guard.js';

/**
 * 注册公开的认证路由（无需登录）
 */
export function createPublicAuthRoutes(config: ServerConfig): Router {
    const router = Router();

    router.post('/users/list', authController.listUsers);
    router.post('/users/login', authController.login);
    router.post('/users/register', authController.publicRegisterUser);
    router.post('/users/recover-step1', authController.recoverStep1);
    router.post('/users/recover-step2', authController.recoverStep2);
    router.post('/users/google-login', authController.googleLogin);

    return router;
}

/**
 * 注册私有认证路由（需登录）
 */
export function createPrivateAuthRoutes(config: ServerConfig): Router {
    const router = Router();

    router.post('/users/logout', requireLogin, authController.logout);
    router.get('/users/me', requireLogin, authController.getCurrentUser);
    router.post('/users/change-password', requireLogin, authController.changePassword);
    router.post('/users/change-name', requireLogin, authController.changeName);
    router.post('/users/change-avatar', requireLogin, authController.changeAvatar);

    // 管理员路由
    router.post('/users/get', requireAdmin, authController.adminGetUsers);
    router.post('/users/create', requireAdmin, authController.adminCreateUser);
    router.post('/users/delete', requireAdmin, authController.adminDeleteUser);
    router.post('/users/slugify', requireAdmin, authController.slugifyEndpoint);
    router.post('/users/disable', requireAdmin, authController.adminToggleUser);
    router.post('/users/enable', requireAdmin, authController.adminToggleUser);
    router.post('/users/promote', requireAdmin, authController.adminToggleUser);
    router.post('/users/demote', requireAdmin, authController.adminToggleUser);

    return router;
}
