import express from 'express';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieSession from 'cookie-session';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createCorsMiddleware } from './shared/middleware/cors.js';
import { errorHandler } from './shared/middleware/error-handler.js';
import { requestLogger } from './shared/middleware/request-logger.js';
import { requestIdMiddleware } from './shared/middleware/request-id.js';
import { performanceMonitor } from './shared/middleware/performance.js';
import { requireLogin, requireAdmin } from './shared/middleware/auth-guard.js';
import { createPublicAuthRoutes, createPrivateAuthRoutes } from './modules/auth/auth.routes.js';
import { createCharacterRoutes } from './modules/characters/characters.routes.js';
import { createAdminCharacterRoutes } from './modules/characters/admin-characters.routes.js';
import { createPublicWorldRoutes, createAdminWorldRoutes } from './modules/worlds/worlds.routes.js';
import { createChatRoutes } from './modules/chats/chats.routes.js';
import { createChatRoutes as createAiChatRoutes } from './modules/backends/chat-completions/chat-completions.routes.js';
import { createDiscoverRoutes } from './modules/characters/discover.routes.js';
import { createPublicCharacterRoutes } from './modules/characters/characters.public.routes.js';
import { createPublicImportRoutes } from './modules/characters/characters.public.import.routes.js';
import { createPublicChatRoutes } from './modules/chats/chats.public.routes.js';
import { createFavoritesRoutes } from './modules/users/favorites.routes.js';
import { createAdminRoutes } from './modules/admin/admin.routes.js';
import { ServerConfig } from './types/config.types.js';

function getCookieSecret(dataRoot: string): string {
    const secretPath = path.join(dataRoot, 'cookie-secret.txt');
    try {
        if (fs.existsSync(secretPath)) {
            return fs.readFileSync(secretPath, 'utf-8').trim();
        }
    } catch {
        // 使用 fallback
    }
    const randomSecret = crypto.randomBytes(32).toString('hex');
    try {
        fs.mkdirSync(dataRoot, { recursive: true });
        fs.writeFileSync(secretPath, randomSecret, 'utf-8');
    } catch {
        // 无法写入密钥文件，使用内存中的随机值
    }
    return randomSecret;
}

export function createApp(config: ServerConfig): express.Express {
    const app = express();

    // ---- 安全头（含 CSP 防护，允许 React 内联脚本/样式） ----
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https:"],
                fontSrc: ["'self'", "data:"],
                frameSrc: ["'self'", "https://accounts.google.com"],
            },
        },
    }));

    // ---- 压缩（跳过 SSE 流式端点，否则会缓冲破坏实时性） ----
    app.use(compression({
        filter: (req: Request, res: Response) => {
            if (req.path === '/api/chat/stream') return false;
            // 使用 compression 模块默认 filter（基于 Content-Type 判断是否可压缩）
            return compression.filter(req, res);
        },
    }));

    // ---- 请求体解析（跳过 multipart/form-data，由 multer 处理） ----
    app.use(express.json({ limit: '500mb', type: ['application/json', 'application/csp-report'] }));
    app.use(express.urlencoded({ extended: true, limit: '500mb' }));

    // ---- CORS ----
    app.use(createCorsMiddleware());

    // ---- 请求 ID 追踪 ----
    app.use(requestIdMiddleware);

    // ---- 性能监控 ----
    app.use(performanceMonitor);

    // ---- 请求日志 ----
    app.use(requestLogger);

    // ---- Cookie 会话 ----
    const sessionSecret = getCookieSecret(config.dataRoot);
    const sessionMaxAge = config.sessionTimeout > 0
        ? config.sessionTimeout * 1000
        : 400 * 24 * 60 * 60 * 1000;

    app.use(cookieSession({
        name: `session-${crypto.createHash('sha256').update(sessionSecret).digest('hex').slice(0, 8)}`,
        sameSite: 'lax' as const,
        httpOnly: true,
        maxAge: sessionMaxAge,
        secret: sessionSecret,
    }));

    app.get('/version', (_req, res) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json({ version: '0.1.0', name: 'simple-tavern' });
    });

    // ---- 健康检查 ----
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
    });

    // ─── 公开路由（无需登录）—— 以下路由不受 CSRF 保护 ───
    // ⚠️ 任何新增公开 POST 路由必须注册在此行之上，否则会被 CSRF 中间件拦截
    app.use('/api', createPublicAuthRoutes(config));

    // ---- AI 聊天 providers 缓存 ----
    app.use('/api/chat/providers', (_req, res, next) => {
        res.setHeader('Cache-Control', 'public, max-age=600');
        next();
    });

    // ---- AI 聊天接口（公开，前端无需后端会话） ----
    app.use('/api', createAiChatRoutes());

    // ---- 角色发现/探索 API（公开，缓存 5 分钟） ----
    app.use('/api/discover', (_req, res, next) => {
        res.setHeader('Cache-Control', 'public, max-age=300');
        next();
    });
    app.use('/api', createDiscoverRoutes());

    // ---- 用户数据 API（收藏、设置，公开） ----
    app.use('/api', createFavoritesRoutes());

    // ---- 用户角色 API（发布、列表，公开） ----
    app.use('/api', createPublicCharacterRoutes());

    // ---- 聊天线程 API（公开） ----
    app.use('/api', createPublicChatRoutes());

    // ---- 角色导入 API（公开，multer 文件上传） ----
    app.use('/api', createPublicImportRoutes());

    // ---- 数据埋点 API（公开，静默接收前端事件） ----
    app.post('/api/analytics/events', (req, res) => {
        const { events } = req.body;
        if (Array.isArray(events) && events.length > 0) {
            // 生产环境可接入正式分析服务；目前仅 DEBUG 日志
            if (process.env.LOG_LEVEL === 'debug') {
                const logger = console;
                logger.debug(`[analytics] received ${events.length} events`);
            }
        }
        res.json({ ok: true });
    });

    // ─── 认证守卫 ───
    app.use(requireLogin);

    // ---- 私有路由（需登录） ----
    app.use('/api', createPrivateAuthRoutes(config));

    // ---- 世界书列表接口（用户端可用，需登录） ----
    app.use('/api/worlds', createPublicWorldRoutes());

    // ---- 角色和聊天路由 ----
    app.use('/api/characters', createCharacterRoutes());
    app.use('/api/chats', createChatRoutes());

    // ---- 管理员角色路由（需 Admin 权限） ----
    app.use('/api/characters', requireAdmin, createAdminCharacterRoutes());

    // ---- 世界书管理路由（需 Admin 权限） ----
    app.use('/api/worlds', requireAdmin, createAdminWorldRoutes());

    // ---- 管理端聚合（stats / llm / reviews）----
    app.use('/api/admin', requireAdmin, createAdminRoutes());

    // ---- 静态文件（通过环境变量可选配置） ----
    const staticDir = process.env.SIMPLE_TAVERN_STATIC_DIR;
    if (staticDir && fs.existsSync(staticDir)) {
        app.use(express.static(staticDir));
    }

    // ---- 统一错误处理 ----
    app.use(errorHandler);

    return app;
}
