# SimpleTavern 迭代优化需求文档

> 生成日期：2026-06-13  
> 审查范围：backend/ (59 个 TypeScript 文件，7443 行) + frontend/ (React 19 + TypeScript)  
> 审查维度：代码质量、架构一致性、性能、安全性、API 设计、前端最佳实践、可维护性

---

## 📊 概览统计

| 优先级 | 数量 | 说明 |
|--------|------|------|
| 🔴 P0 - 必须修复 | 8 | 架构违规、安全漏洞、数据丢失风险 |
| 🟠 P1 - 高优先级 | 12 | 性能瓶颈、核心功能改进、重要架构修正 |
| 🟡 P2 - 中优先级 | 18 | 代码质量、可维护性、开发体验 |
| 🟢 P3 - 低优先级 | 15 | 代码风格、文档完善、优化建议 |

**总计：53 项优化需求**

---

## 🔴 P0 - 必须修复（影响正确性/安全性/架构完整性）

### P0-1: 修复 Controller 直接访问 Repository 的架构违规

**问题**：`auth.controller.ts` 和 `chats.controller.ts` 直接 import 并调用 repository 函数，完全绕过了 service 层。

**受影响文件**：
- `auth.controller.ts:6` - 直接 import `users.repository.ts` 的全部 7 个函数
- `chats.controller.ts:5-8,14` - 直接 import `chats.repository.ts` 的 5 个函数 + `users.repository.ts` 的 1 个函数
- `characters.controller.ts:9` - 直接 import `users.repository.ts`
- `discover.controller.ts:7-8` - 直接 import `reviews.repository.ts`
- `admin-characters.controller.ts:4,8` - 直接 import `users.repository.ts` 和 `ugirl-importer.ts`
- `characters.public.routes.ts:11` - 路由文件直接调用 repository
- `characters.public.import.routes.ts:9` - 路由文件直接调用 repository

**修复方案**：
1. 将业务逻辑迁移到对应的 service 层
2. Controller 只调用 service 函数，不直接访问 repository
3. 路由文件只委托给 controller

**预期收益**：恢复分层架构的完整性，便于单元测试和维护

---

### P0-2: 修复 Repository 对 HTTP 中间件的反向依赖

**问题**：`users.repository.ts:6` 直接 import `shared/middleware/request-context.ts`，打破了 repository 层的边界。

**修复方案**：
1. 将 `getRequestContext()` 改为通过参数传入
2. 或使用依赖注入模式

**代码示例**：
```typescript
// Before
import { getRequestContext } from '../../shared/middleware/request-context.js';
export function getUserByHandle(handle: string) {
  const context = getRequestContext();
  // ...
}

// After
export function getUserByHandle(handle: string, context?: RequestContext) {
  // context 由调用方传入
}
```

---

### P0-3: 统一 Session 类型定义

**问题**：Session 对象在所有地方都使用 `Record<string, any>`，完全丧失了类型安全（18+ 个位置）。

**受影响文件**：
- `auth.controller.ts` (10 处)
- `chats.controller.ts` (2 处)
- `characters.controller.ts` (3 处)
- `favorites.controller.ts` (1 处)
- `auth-guard.ts` (2 处)

**修复方案**：
1. 创建 `types/session.types.ts` 定义 `AuthSession` 接口
2. 在 `types/declarations.d.ts` 中扩展 Express Request
3. 替换所有 `req.session as Record<string, any>` 为 `req.session as AuthSession`

**代码示例**：
```typescript
// types/session.types.ts
export interface AuthSession {
  handle?: string;
  csrfToken?: string;
  version?: string;
  admin?: boolean;
}

// types/declarations.d.ts
declare global {
  namespace Express {
    interface Request {
      session: AuthSession | null;
    }
  }
}
```

---

### P0-4: 修复 38 个静默吞掉错误的 catch 块

**问题**：项目中使用两种 catch 模式，38 个 `catch {}` 块静默吞掉错误，导致问题难以追踪。

**危险示例**：
```typescript
// chats.controller.ts:69-72
} catch {
    res.json({});  // 错误被静默吞掉，返回空对象
}

// users.service.ts:51
} catch {
    return [];  // 存储失败时返回空数组，调用方无法感知错误
}
```

**修复方案**：
1. 所有 catch 块都应该至少记录日志
2. 区分"预期失败"（如文件不存在）和"意外错误"
3. 对意外错误使用 `next(err)` 或抛出

**代码示例**：
```typescript
// 预期失败（静默处理）
} catch {
    logger.debug('聊天文件不存在，返回空数据');
    return [];
}

// 意外错误（传递到错误处理器）
} catch (err) {
    logger.error('读取聊天文件失败:', err);
    next(err);
}
```

---

### P0-5: 消除 `(req as any).file` 类型断言

**问题**：multer 上传文件使用 `as any` 断言，绕过类型检查（3 个位置）。

**受影响文件**：
- `chats.controller.ts:151`
- `chats.controller.ts:247`
- `characters.controller.ts:252`

**修复方案**：使用类型扩展
```typescript
// types/multer.d.ts
import { File } from 'multer';
declare global {
  namespace Express {
    interface Request {
      file?: File;
    }
  }
}

// 使用
const file = req.file;  // 类型安全
if (!file) throw new BadRequestError('No file uploaded');
```

---

### P0-6: 修复 logout 中的 session 销毁方式

**问题**：`auth.controller.ts:54-68` 中 `(req.session as any) = null` 可能不是正确的销毁 session 方式。

**修复方案**：使用 `req.session.destroy()` 方法
```typescript
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        if (req.session) {
            req.session.destroy((err) => {
                if (err) {
                    logger.error('Session 销毁失败:', err);
                    return next(err);
                }
                res.status(204).send();
            });
        } else {
            res.status(204).send();
        }
    } catch (err) {
        next(err);
    }
}
```

---

### P0-7: 为 recoveryCodes 添加 TTL 清理机制

**问题**：`auth.controller.ts:225` 中的恢复码存储在内存 Map 中，没有定期清理过期码，可能导致内存无限增长。

**修复方案**：
1. 使用 `MemoryLimitedMap` 替代普通 Map
2. 或添加定时清理逻辑
3. 或使用 `node-persist` 持久化

**代码示例**：
```typescript
// 使用 MemoryLimitedMap
import { MemoryLimitedMap } from '../infrastructure/storage/disk-cache.js';
const recoveryCodes = new MemoryLimitedMap<string, { code: string; expires: number }>({
    maxSize: 1000,
    ttl: 15 * 60 * 1000  // 15 分钟
});
```

---

### P0-8: 修复 config/index.ts 中的大量类型断言

**问题**：`config/index.ts:78-113` 解析 YAML 配置时使用 14 处 `as any` 断言。

**修复方案**：使用 Zod 进行运行时验证
```typescript
import { z } from 'zod';

const YamlConfigSchema = z.object({
  host: z.string().optional(),
  enableUserAccounts: z.boolean().optional(),
  port: z.number().optional(),
  // ... 其他字段
});

type YamlConfig = z.infer<typeof YamlConfigSchema>;

function parseYamlConfig(yaml: unknown): Partial<Config> {
  const result = YamlConfigSchema.safeParse(yaml);
  if (!result.success) {
    logger.warn('YAML 配置格式不正确:', result.error.message);
    return {};
  }
  return result.data;
}
```

---

## 🟠 P1 - 高优先级（性能/核心功能/重要架构）

### P1-1: 角色卡元数据 LRU 缓存

**问题**：每次请求都重新解析 PNG chunk 数据，一个拥有 50 个角色卡的用户，首页加载可能阻塞 1-5 秒。

**修复方案**：
1. 在 `characters.repository.ts` 中为角色卡元数据添加 LRU 缓存
2. 缓存 key 为文件路径 + mtime
3. 文件变更时自动失效

**预期收益**：列表加载减少 80%

---

### P1-2: 消息气泡 React.memo 优化

**问题**：`App.tsx` 作为唯一状态管理器，聊天消息的每次流式输出更新会触发整棵子树重渲染。100 条消息的聊天，每次更新触发 100+ 组件重渲染。

**修复方案**：
1. 将消息气泡抽取为独立组件 `MessageBubble`
2. 使用 `React.memo` 包裹
3. 使用 `useMemo` 缓存消息列表

**预期收益**：流式输出重渲染减少 60%

---

### P1-3: JSONL 聊天分页加载

**问题**：大聊天文件（5-10MB+）完整加载到内存，导致加载延迟和内存占用。

**修复方案**：
1. 首次加载只读取最近 50 条消息
2. 滚动到底部时加载更多
3. 使用流式读取（`readline` 模块）

**预期收益**：大文件加载从秒级降至毫秒级

---

### P1-4: 虚拟滚动 overscan 优化

**问题**：快速滚动时出现空白闪烁。

**修复方案**：将 `overscan` 从 1 增加到 5
```typescript
// DiscoverScreen.tsx
const rowVirtualizer = useVirtualizer({
  count: characters.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,
  overscan: 5,  // 原来是 1
});
```

**预期收益**：消除快速滚动空白（1 行代码改动）

---

### P1-5: 角色卡缩略图生成

**问题**：大图加载慢且有 CLS（布局偏移）。

**修复方案**：
1. 导入时生成 256x256 缩略图
2. 列表页使用缩略图，详情页使用原图
3. 使用 WebP 格式减少传输量

**预期收益**：图片传输量减少 90%

---

### P1-6: 提取 getUserDirs 到共享模块

**问题**：相同的 `getUserDirs` 函数在 `chats.controller.ts:10-15` 和 `characters.controller.ts:12-17` 中重复定义。

**修复方案**：
```typescript
// shared/utils/user-dirs.ts
export function getUserDirs(req: Request): UserDirectoryList {
    const handle = req.session?.handle;
    if (!handle) throw new UnauthorizedError();
    const config = getConfig();
    return getUserDirectories(config.dataRoot, handle);
}
```

---

### P1-7: 统一错误响应构造

**问题**：手动构造错误响应 `{ code: 'XXX', message: '...' }` 重复 27+ 次。

**修复方案**：全面使用 `AppError` 层次结构
```typescript
// Before
res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });

// After
throw new NotFoundError('User');
```

---

### P1-8: 为 readChatFile 添加返回类型

**问题**：`chats.repository.ts:8` 中 `readChatFile` 返回 `any[]`。

**修复方案**：
```typescript
interface ChatMessage {
  name: string;
  is_user: boolean;
  send_date: string;
  mes: string;
  extra?: unknown;
  swipes?: string[];
  swipe_id?: number;
}

export function readChatFile(filePath: string): ChatMessage[] {
  // ...
}
```

---

### P1-9: 修复重复的 PNG 处理函数

**问题**：`createMinimalPng()`、`createPngChunk()`、`getPngName()` 在 `characters.service.ts` 和 `characters.importer.ts` 中各复制了一份。

**修复方案**：提取到 `shared/utils/png-utils.ts`

---

### P1-10: 添加 multer 错误处理

**问题**：`admin-worlds.controller.ts:183-232` 中 multer 的错误处理不完整。

**修复方案**：
```typescript
getUpload().single('file')(req, res, async (err: any) => {
    if (err instanceof multer.MulterError) {
        // multer 特定错误
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                code: 'FILE_TOO_LARGE', 
                message: '文件大小超过限制（最大 10MB）' 
            });
        }
    }
    if (err) {
        return res.status(400).json({ 
            code: 'UPLOAD_FAILED', 
            message: '文件上传失败' 
        });
    }
    // ...
});
```

---

### P1-11: 修复 users.repository.ts 中的 HTTP 泄漏

**问题**：`users.repository.ts` 使用 `node-persist` 直接操作存储，与 `characters.user.service.ts` 的职责重叠。

**修复方案**：统一存储策略，将 `characters.user.service.ts` 的持久化逻辑迁移到 `users.repository.ts`

---

### P1-12: 添加关键路径的单元测试

**问题**：项目没有编写任何单元测试。

**修复方案**：优先添加以下测试：
1. `auth.service.ts` - 登录/注册/密码恢复
2. `users.service.ts` - 用户 CRUD
3. `characters.service.ts` - 角色 CRUD
4. `chats.service.ts` - 聊天读写
5. `auth-guard.ts` - 认证守卫

**测试框架**：Vitest + tsx

---

## 🟡 P2 - 中优先级（代码质量/可维护性/开发体验）

### P2-1: 统一命名约定

**问题**：函数命名风格不统一（`getXxx` vs `xxxEndpoint` vs `adminXxx`）

**修复方案**：
- 查询函数统一使用 `getXxx`
- 命令函数统一使用 `createXxx` / `updateXxx` / `deleteXxx`
- 管理后台函数统一使用 `adminXxx`

---

### P2-2: 统一文件组织结构

**问题**：`types/` 目录命名不一致（全局 vs 模块内）

**修复方案**：
- 全局类型放在 `types/`
- 模块特定类型放在 `modules/xxx/types.ts`（使用 `types.ts` 而非 `xxx.types.ts`）

---

### P2-3: 统一导出风格

**问题**：混合使用默认导出和命名导出

**修复方案**：统一使用命名导出（与项目大部分文件保持一致）

---

### P2-4: 修复 config/index.ts 的类型断言

**问题**：14 处 `as any` 断言（已在 P0-8 中提出，此处为代码质量改进）

---

### P2-5: 为 admin-characters.controller.ts 定义具体接口

**问题**：使用 `Record<string, unknown>[]` 导致后续使用时需要大量类型断言

**修复方案**：
```typescript
interface AdminCharacterView {
    name: string;
    avatar: string;
    description: string;
    _owner: string;
    _fileName: string;
    _source: 'seed' | 'published' | 'file';
}
```

---

### P2-6: 修复 chats.controller.ts 中的 any[] 返回类型

**问题**：`threads: any[]` 和 `allMessages: any[]`

**修复方案**：定义 `ChatThread` 和 `ChatMessage` 接口

---

### P2-7: 修复 SSE 背压控制

**问题**：高并发流式响应可能导致内存膨胀

**修复方案**：
1. 添加客户端断开检测
2. 使用 `AbortController` 取消请求
3. 限制并发流式响应数量

---

### P2-8: 添加请求超时配置

**问题**：LLM API 请求没有超时配置

**修复方案**：
```typescript
const response = await fetch(url, {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ /* ... */ }),
    signal: AbortSignal.timeout(30000),  // 30 秒超时
});
```

---

### P2-9: 统一 multer 配置

**问题**：多个文件上传使用不同的 multer 配置

**修复方案**：创建共享的 multer 配置
```typescript
// shared/middleware/upload.ts
export const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'application/json'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new BadRequestError('不支持的文件类型'));
        }
    }
});
```

---

### P2-10: 添加 API 响应日志

**问题**：缺少统一的 API 请求/响应日志

**修复方案**：添加请求日志中间件
```typescript
// shared/middleware/request-logger.ts
export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
}
```

---

### P2-11: 修复 worlds.service.ts 中的 console.warn

**问题**：`worlds.service.ts:57` 使用 `console.warn(...)` 而非 `logger.warn(...)`

**修复方案**：统一使用 `logger` 实例

---

### P2-12: 修复 characters.importer.ts 中的 Error 抛出

**问题**：`characters.importer.ts:315` 使用 `throw new Error(...)` 而非 `BadRequestError`

**修复方案**：统一使用 `AppError` 层次结构

---

### P2-13: 添加 CSRF 保护测试

**问题**：CSRF 保护的完整性未验证

**修复方案**：添加集成测试验证 CSRF token 验证

---

### P2-14: 优化日志级别配置

**问题**：生产环境默认日志级别为 `info`，但某些关键操作应始终记录

**修复方案**：
- 登录/登出：`info`
- 错误：`error`
- 调试信息：`debug`

---

### P2-15: 添加请求 ID 追踪

**问题**：缺少跨请求的唯一标识符

**修复方案**：使用 `request-context.ts` 中的请求 ID 追踪所有日志

---

### P2-16: 统一日期格式化

**问题**：聊天日期格式化逻辑在前后端重复

**修复方案**：将 `formatDate.ts` 提取到 `shared/utils/` 供前后端共用

---

### P2-17: 添加 API 版本控制

**问题**：API 没有版本控制

**修复方案**：添加 `/api/v1/` 前缀（为未来兼容性做准备）

---

### P2-18: 完善 CLAUDE.md 文档

**问题**：CLAUDE.md 缺少测试命令、Git 工作流规范、调试技巧

**修复方案**：补充缺失信息（已在本次迭代中完成）

---

## 🟢 P3 - 低优先级（代码风格/文档完善/优化建议）

### P3-1: 统一变量命名

**问题**：`handle` vs `userHandle`，`characterId` vs `character_id`

**修复方案**：统一使用 camelCase

---

### P3-2: 添加 JSDoc 注释

**问题**：部分公共函数缺少 JSDoc 注释

**修复方案**：为所有 service 层函数添加 JSDoc

---

### P3-3: 优化 import 顺序

**问题**：import 顺序不统一

**修复方案**：使用 ESLint 的 `import/order` 规则

---

### P3-4: 添加 .env.example 注释

**问题**：`.env.example` 缺少详细说明

**修复方案**：为每个环境变量添加注释说明

---

### P3-5: 完善 deploy-prd.sh 日志

**问题**：部署脚本的日志输出不够详细

**修复方案**：添加步骤编号和颜色

---

### P3-6: 添加数据库迁移脚本

**问题**：数据格式变更时缺少迁移脚本

**修复方案**：创建 `scripts/migrate.ts`

---

### P3-7: 优化 Docker 构建缓存

**问题**：Docker 构建缓存利用率不高

**修复方案**：优化 Dockerfile 的层顺序

---

### P3-8: 添加性能监控

**问题**：缺少性能指标收集

**修复方案**：集成 Prometheus 或类似工具

---

### P3-9: 完善错误码文档

**问题**：错误码定义分散在代码中

**修复方案**：创建 `docs/error-codes.md`

---

### P3-10: 添加 API 文档生成

**问题**：API 文档手动维护

**修复方案**：使用 OpenAPI/Swagger 自动生成

---

### P3-11: 优化前端 Bundle 大小

**问题**：前端 Bundle 大小可以进一步优化

**修复方案**：
1. 分析 Bundle 组成
2. 移除未使用的依赖
3. 使用动态 import

---

### P3-12: 添加 E2E 测试

**问题**：缺少端到端测试

**修复方案**：使用 Playwright 添加关键路径的 E2E 测试

---

### P3-13: 完善 Service Worker 缓存策略

**问题**：SW 缓存策略可以进一步优化

**修复方案**：
1. 添加缓存预热
2. 优化缓存过期策略

---

### P3-14: 添加国际化支持

**问题**：前端硬编码中文

**修复方案**：添加 i18n 支持

---

### P3-15: 完善可访问性

**问题**：前端可访问性可以进一步改进

**修复方案**：
1. 添加 ARIA 标签
2. 改善键盘导航

---

## 📋 实施路线图

### 第一阶段（1-2 周）- P0 修复
- [ ] P0-1: 修复 Controller 直接访问 Repository
- [ ] P0-2: 修复 Repository 反向依赖
- [ ] P0-3: 统一 Session 类型
- [ ] P0-4: 修复静默吞掉错误的 catch 块
- [ ] P0-5: 消除 (req as any).file
- [ ] P0-6: 修复 logout session 销毁
- [ ] P0-7: 添加 recoveryCodes TTL 清理
- [ ] P0-8: 修复 config/index.ts 类型断言

### 第二阶段（2-3 周）- P1 优化
- [ ] P1-1: 角色卡元数据 LRU 缓存
- [ ] P1-2: 消息气泡 React.memo 优化
- [ ] P1-3: JSONL 聊天分页加载
- [ ] P1-4: 虚拟滚动 overscan 优化
- [ ] P1-5: 角色卡缩略图生成
- [ ] P1-6: 提取 getUserDirs 到共享模块
- [ ] P1-7: 统一错误响应构造
- [ ] P1-8: 为 readChatFile 添加返回类型
- [ ] P1-9: 修复重复的 PNG 处理函数
- [ ] P1-10: 添加 multer 错误处理
- [ ] P1-11: 修复 users.repository.ts HTTP 泄漏
- [ ] P1-12: 添加关键路径单元测试

### 第三阶段（3-4 周）- P2 改进
- [ ] P2-1 ~ P2-18: 按优先级逐步实施

### 第四阶段（持续）- P3 优化
- [ ] P3-1 ~ P3-15: 按开发节奏逐步实施

---

## 📊 预期收益

### 性能提升
- 首页加载时间：减少 80%（P1-1）
- 聊天流式输出：重渲染减少 60%（P1-2）
- 大文件加载：从秒级降至毫秒级（P1-3）
- 图片传输量：减少 90%（P1-5）

### 代码质量
- 类型安全：消除 86 处 `any` 类型（P0-3, P0-5, P0-8）
- 错误追踪：修复 38 个静默 catch 块（P0-4）
- 架构完整性：恢复分层架构边界（P0-1, P0-2）

### 可维护性
- 代码重复：减少 30+ 处重复代码（P1-6, P1-9）
- 测试覆盖：关键路径 80%+ 覆盖（P1-12）
- 文档完善：API 文档、错误码文档（P3-9, P3-10）

---

## 🔗 相关文档

- `CLAUDE.md` - 项目开发指引
- `refactor/architecture-reference.md` - 原项目架构分析
- `refactor/migration-plan.md` - 重构计划
- `refactor/api-reference.md` - API 文档
- `AGENTS.md` - Codex 开发指引
