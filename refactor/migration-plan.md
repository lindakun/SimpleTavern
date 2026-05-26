# SillyTavern 后端迁移计划

## Context

原项目 `/Users/linda/code/SillyTavern/` 存在以下核心架构问题（详见 [architecture-reference.md](./architecture-reference.md) 第一部分）：

0. **项目分工**：原项目代码只读参考不修改；新项目在 `/Users/linda/code/SimpleTavern/` 全新搭建
1. **前后端未分离**：前端 12537 行 `script.js` 作为中央编排器，170+ 端点硬编码在前端文件中
2. **后端代码臃肿**：47 个路由文件，部分超过千行，单文件承担过多职责
3. **架构耦合严重**：循环依赖、跨层依赖、全局状态散落、集中路由注册
4. **无类型安全**：纯 JavaScript + JSDoc，无编译时检查

## 重构策略：独立搭建

**新项目在 `/Users/linda/code/SimpleTavern/` 目录下全新搭建，与原项目完全独立。**

```
SillyTavern/    ← 原项目，不动，继续跑 8000 端口
SimpleTavern/   ← 新项目（前后端分离）
  backend/      ← TypeScript 后端，跑 8001 端口
  frontend/     ← React 前端，跑 3000 端口（Vite 代理 /api/* → 8001）
```

## 当前进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| 0 | 基础设施搭建 | ✓ 完成 |
| 1 | 认证与用户模块 | ✓ 完成 |
| 2 | 角色与聊天模块 | ✓ 完成 |
| 3 | AI 后端模块 | ✓ 完成 |
| 4 | 用户功能模块 | ✓ 完成（已重新定范围） |
| 5 | 图像与语音模块 | 待开始 |
| 6 | 收尾与清理 | 待开始 |

### 关于 Phase 4 范围调整

原计划 Phase 4 覆盖 14 个后端业务模块（群组、世界信息、设置、文件等），按原始 SillyTavern 后端功能列表排列。实际按前端页面需求重新定范围，优先实现直接影响前端功能的 API：

- **收藏系统** — GET/POST/DELETE `/api/users/favorites`
- **角色发布** — POST `/api/characters/publish` + GET `/api/users/characters`
- **聊天线程** — GET `/api/chat/threads` + GET `/api/chat/threads/:id`
- **用户设置** — GET/POST `/api/users/settings`
- **角色导入** — POST `/api/characters/import`（兼容 V1/V2/V3/Pygmalion）
- **发现页面** — GET `/api/discover`（种子角色 + 导入角色合并）

已推迟的模块（前端无对应页面）：群组管理、世界信息、FAQ/反馈、文件管理。

## 目标架构（已实现）

```
backend/src/
├── app.ts                    # Express 应用组装
├── server.ts                 # 入口（dotenv 加载）
├── config/                   # 配置管理
│   ├── index.ts              # 配置加载（yaml + CLI 参数）
│   └── env.ts                # CLI 参数解析
├── common/                   # 公共模块
│   ├── logger.ts             # 日志（chalk）
│   ├── errors.ts             # AppError 错误层次
│   ├── result.ts             # Result<T,E> 类型
│   └── utils.ts              # 密码哈希、slug 化等
├── types/                    # 类型定义
│   ├── api.types.ts          # API 请求/响应类型
│   ├── models.types.ts       # 数据模型类型
│   ├── config.types.ts       # 配置类型
│   └── declarations.d.ts     # 第三方模块类型声明
├── data/                     # 种子数据
│   └── seed-characters.json  # 8 个默认角色
├── shared/middleware/        # 共享中间件
│   ├── error-handler.ts      # 统一错误处理
│   ├── auth-guard.ts         # 登录/管理员守卫
│   ├── cors.ts               # CORS 配置
│   └── request-context.ts    # AsyncLocalStorage
├── infrastructure/storage/   # 基础设施
│   └── disk-cache.ts         # MemoryLimitedMap
└── modules/                  # 业务模块
    ├── auth/                 # 认证
    │   ├── auth.service.ts   # 登录/密码验证
    │   ├── auth.controller.ts# 路由处理器
    │   └── auth.routes.ts    # 公开/私有路由
    ├── users/                # 用户
    │   ├── users.repository.ts   # node-persist 存取
    │   ├── users.service.ts      # 收藏/设置持久化
    │   ├── favorites.controller.ts  # 收藏+设置 API
    │   └── favorites.routes.ts
    ├── characters/           # 角色
    │   ├── characters.types.ts    # 类型定义
    │   ├── characters.parser.ts   # PNG 角色卡读写
    │   ├── characters.validator.ts# 校验
    │   ├── characters.repository.ts # 文件读取+缓存
    │   ├── characters.service.ts  # 业务逻辑
    │   ├── characters.controller.ts # 路由处理器
    │   ├── characters.routes.ts   # 路由注册
    │   ├── characters.importer.ts # 导入引擎（V1/V2/V3/Pygmalion）
    │   ├── characters.user.service.ts # 用户角色存储
    │   ├── seed.service.ts    # 种子数据加载
    │   ├── discover.controller.ts # 发现 API
    │   └── discover.routes.ts
    ├── chats/                # 聊天
    │   ├── chats.types.ts    # 类型定义
    │   ├── chats.repository.ts   # JSONL 文件读写
    │   ├── chats.service.ts  # 业务逻辑
    │   ├── chats.controller.ts   # 路由处理器
    │   ├── chats.routes.ts   # 路由注册
    │   └── chats.public.routes.ts
    └── backends/             # AI 后端
        ├── types.ts          # 共享类型
        ├── llm-config.ts     # 多 LLM 配置管理
        └── chat-completions/ # 聊天补全
            ├── chat-completions.service.ts # OpenAI-compatible API
            ├── chat-completions.controller.ts
            └── chat-completions.routes.ts
```

## 分阶段迁移计划

### 阶段 0 ✅ 基础设施搭建

**目标**：建立 TypeScript 编译环境和项目骨架

1. `tsconfig.json` — `strict: true`, `module: NodeNext`
2. 安装 TypeScript 相关依赖（`typescript`, `tsx`, `@types/*`）
3. 配置构建脚本
4. 创建 `src/common/`（logger、errors、result）
5. 创建 `src/config/`（替代 `command-line.js` + `globalThis`）
6. 创建 `src/shared/middleware/error-handler.ts`

**验证**：`npm run build` 成功编译，`npm start` 启动空壳服务 ✓

### 阶段 1 ✅ 认证与用户模块

**目标**：登录/注册/密码恢复 + 用户 CRUD

1. `src/modules/auth/` — 登录/登出/注册/密码恢复
2. `src/modules/users/users.repository.ts` — node-persist 用户存储
3. `src/shared/middleware/auth-guard.ts` — 登录/管理员守卫
4. `src/shared/middleware/request-context.ts` — AsyncLocalStorage

**验证**：用户注册/登录/登出/密码修改全部正常 ✓

### 阶段 2 ✅ 角色与聊天模块

**目标**：角色 CRUD + PNG 角色卡 + 聊天 CRUD

1. `src/modules/characters/` — 角色 CRUD/导入/导出/PNG 解析
2. `src/modules/chats/` — 聊天 CRUD/导入/导出/群组聊天
3. `src/infrastructure/storage/disk-cache.ts` — MemoryLimitedMap

**验证**：角色创建/编辑/删除/导入/导出/聊天保存/加载全部正常 ✓

### 阶段 3 ✅ AI 后端模块

**目标**：OpenAI-compatible 聊天补全 + 多 LLM 配置

1. `src/modules/backends/chat-completions/` — 通用聊天补全
2. `src/modules/backends/llm-config.ts` — 多 LLM 配置（环境变量）
3. `POST /api/chat` — 角色扮演聊天接口
4. `GET /api/chat/providers` — 可用 LLM 列表

**关键决策**：使用 OpenAI-compatible API 统一对接，不绑定特定 provider。

**验证**：LongCat LLM 角色扮演回复正常，多轮对话上下文连贯 ✓

### 阶段 4 ✅ 用户功能模块（已重新定范围）

**目标**：按前端页面需求实现用户数据持久化

1. **收藏系统** — GET/POST/DELETE `/api/users/favorites`
2. **角色发布** — POST `/api/characters/publish` + GET `/api/users/characters`
3. **聊天线程** — GET `/api/chat/threads` + GET `/api/chat/threads/:id`
4. **用户设置** — GET/POST `/api/users/settings`
5. **角色导入** — POST `/api/characters/import`（兼容 V1/V2/V3/Pygmalion）
6. **发现页面** — GET `/api/discover`（种子角色 + 导入角色合并）

**验证**：收藏刷新后保持、角色发布后在"我的角色"可见、聊天线程列表正常 ✓

### 阶段 5：图像与语音模块

**计划中**：SD / Horde / TTS / 语音合成

### 阶段 6：收尾与清理

**计划中**：回归测试、前端全面接管

---

## 验证方案

### 当前验证方法

```bash
# 启动后端
cd backend && npx tsx src/server.ts

# 启动前端
cd frontend && ./node_modules/.bin/vite --port 3000

# 测试 API
curl http://localhost:8001/api/discover          # 角色发现
curl -X POST http://localhost:8001/api/chat ...  # AI 聊天
curl http://localhost:8001/api/users/favorites   # 收藏
```

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 项目完全独立，无代码冲突风险 | 两边完全独立 |
| 前端 API 契约变更 | 新代码严格保持 URL 和请求/响应格式不变 |
| 数据格式不兼容 | Repository 层保持现有文件存储格式不变 |
| 跨域问题 | Vite proxy 自动代理，后端配置 CORS |
