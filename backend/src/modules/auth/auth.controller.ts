import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service.js';
import * as googleService from './google.service.js';
import { BadRequestError } from '../../common/errors.js';
import { slugify } from '../../common/utils.js';
import { getUserByHandle, saveUser, deleteUser, createUserDirectories, removeUserDirectories, userExists, saveEmailMapping } from '../users/users.repository.js';
import { getConfig } from '../../config/index.js';
import { logger } from '../../common/logger.js';

/**
 * POST /api/users/list
 */
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const config = getConfig();
        if (config.enableDiscreetLogin) {
            res.status(204).send();
            return;
        }
        const users = await authService.getPublicUserList();
        res.json(users);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/login
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, password } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        // 简化版：暂时绕过 rate limiter
        const result = await authService.login(handle, password);

        const session = req.session as Record<string, any>;
        session.handle = result.handle;
        session.version = result.version;
        session.admin = result.admin;

        res.json({ handle: result.handle, admin: result.admin });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/logout
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const session = req.session as Record<string, any> | null;
        if (session) {
            session.handle = null;
            session.csrfToken = null;
            session.version = null;
            session.admin = null;
            (req.session as any) = null;
        }
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/users/me
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const session = req.session as Record<string, any> | null;
        const handle = session?.handle;
        if (!handle) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const { getUserViewModel } = await import('../users/users.repository.js');
        const view = await getUserViewModel(user);
        res.json(view);
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/change-password
 */
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, oldPassword, newPassword } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        const session = req.session as Record<string, any> | null;
        const isAdmin = session?.admin === true;
        const isOwner = session?.handle === handle;

        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        await authService.changeUserPassword(handle, newPassword, oldPassword, isAdmin);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/change-name
 */
export async function changeName(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, name } = req.body;
        if (!handle || !name) {
            throw new BadRequestError('Missing required fields');
        }

        const session = req.session as Record<string, any> | null;
        const isAdmin = session?.admin === true;
        const isOwner = session?.handle === handle;

        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(404).json({ error: 'Not Found', message: 'User not found' });
            return;
        }

        user.name = name;
        await saveUser(user);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/change-avatar
 */
export async function changeAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, avatar } = req.body;
        if (!handle || avatar === undefined) {
            throw new BadRequestError('Missing required fields');
        }

        if (avatar !== '' && !avatar.startsWith('data:image/')) {
            res.status(400).json({ error: 'Invalid data URL' });
            return;
        }

        const session = req.session as Record<string, any> | null;
        const isAdmin = session?.admin === true;
        const isOwner = session?.handle === handle;

        if (!isOwner && !isAdmin) {
            res.status(403).json({ error: 'Unauthorized' });
            return;
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(404).json({ error: 'Not Found', message: 'User not found' });
            return;
        }

        const { saveAvatar } = await import('../users/users.repository.js');
        await saveAvatar(handle, avatar);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/recover-step1
 */
export async function recoverStep1(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(404).json({ error: 'Not Found', message: 'User not found' });
            return;
        }
        if (!user.enabled) {
            res.status(403).json({ error: 'Forbidden', message: '账号已被禁用' });
            return;
        }

        const code = authService.generateRecoveryCode();
        // 存储恢复码到内存（简化版，后续可完善）
        recoveryCodes.set(handle, { code, expires: Date.now() + 5 * 60 * 1000 });
        logger.info(`[密码恢复] 用户 ${handle} 的恢复码: ${code}`);

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

// 恢复码内存存储（简化版）
const recoveryCodes = new Map<string, { code: string; expires: number }>();

/**
 * POST /api/users/recover-step2
 */
export async function recoverStep2(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, code, newPassword } = req.body;
        if (!handle || !code) {
            throw new BadRequestError('Missing required fields');
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(404).json({ error: 'Not Found', message: 'User not found' });
            return;
        }
        if (!user.enabled) {
            res.status(403).json({ error: 'Forbidden', message: '账号已被禁用' });
            return;
        }

        const stored = recoveryCodes.get(handle);
        if (!stored || stored.code !== code || stored.expires < Date.now()) {
            recoveryCodes.delete(handle);
            res.status(403).json({ error: 'Incorrect code' });
            return;
        }

        recoveryCodes.delete(handle);
        await authService.changeUserPassword(handle, newPassword, undefined, true);

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/register（公开注册，无需登录）
 */
export async function publicRegisterUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, name, password } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        const slugged = slugify(handle);
        if (!slugged) {
            res.status(400).json({ error: 'Invalid handle' });
            return;
        }

        if (await userExists(slugged)) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }

        await authService.registerUser(slugged, name, password, false);
        const config = getConfig();
        createUserDirectories(config.dataRoot, slugged);

        // 保存邮箱 → handle 映射（用于邮箱登录）
        const { email } = req.body;
        if (email) {
            await saveEmailMapping(email, slugged);
        }

        // 自动登录：设置 session
        const session = req.session as Record<string, any>;
        session.handle = slugged;
        session.version = authService.getAccountVersion(
            await getUserByHandle(slugged) as any
        );
        session.admin = false;

        res.json({ handle: slugged });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/create（需要管理员权限）
 */
export async function adminCreateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, name, password, admin } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        const slugged = slugify(handle);
        if (!slugged) {
            res.status(400).json({ error: 'Invalid handle' });
            return;
        }

        if (await userExists(slugged)) {
            res.status(409).json({ error: 'User already exists' });
            return;
        }

        await authService.registerUser(slugged, name, password, admin);
        const config = getConfig();
        createUserDirectories(config.dataRoot, slugged);

        res.json({ handle: slugged });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/delete（管理员）
 */
export async function adminDeleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle, purge } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        const session = req.session as Record<string, any> | null;
        if (session?.handle === handle) {
            res.status(400).json({ error: 'Cannot delete yourself' });
            return;
        }

        if (handle === 'default-user') {
            res.status(400).json({ error: 'Sorry, but the default user cannot be deleted. It is required as a fallback.' });
            return;
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(404).json({ error: 'Not Found', message: 'User not found' });
            return;
        }

        await deleteUser(handle);

        if (purge) {
            const config = getConfig();
            removeUserDirectories(config.dataRoot, handle);
        }

        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/disable / enable / promote / demote
 */
export async function adminToggleUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { handle } = req.body;
        if (!handle) {
            throw new BadRequestError('Missing required fields');
        }

        const session = req.session as Record<string, any> | null;
        const action = req.path.split('/').pop(); // disable/enable/promote/demote

        if ((action === 'disable' || action === 'demote') && session?.handle === handle) {
            res.status(400).json({ error: `Cannot ${action} yourself` });
            return;
        }

        const user = await getUserByHandle(handle);
        if (!user) {
            res.status(404).json({ error: 'Not Found', message: 'User not found' });
            return;
        }

        switch (action) {
            case 'disable':
                user.enabled = false;
                break;
            case 'enable':
                user.enabled = true;
                break;
            case 'promote':
                user.admin = true;
                break;
            case 'demote':
                user.admin = false;
                break;
        }

        await saveUser(user);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/google-login
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { idToken } = req.body;
        if (!idToken) {
            throw new BadRequestError('idToken is required');
        }

        const profile = await googleService.verifyGoogleIdToken(idToken);
        const { user, isNewUser } = await googleService.findOrCreateGoogleUser(profile);
        const result = googleService.getGoogleLoginResult(user);

        const session = req.session as Record<string, any>;
        session.handle = result.handle;
        session.version = result.version;
        session.admin = result.admin;

        res.json({ handle: result.handle, admin: result.admin, isNewUser });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/slugify
 */
export async function slugifyEndpoint(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { text } = req.body;
        if (!text) {
            throw new BadRequestError('Missing required fields');
        }
        res.send(slugify(text));
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/users/get（管理员获取所有用户）
 */
export async function adminGetUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const users = await authService.getAllUsersList();
        res.json(users);
    } catch (err) {
        next(err);
    }
}
