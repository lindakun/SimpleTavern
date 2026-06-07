# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

本文件为 Claude Code 提供 SimpleTavern 重构工作区的开发指引。

## 项目概述

本目录是 **SillyTavern 后端重构**的独立工作区。重构代码**全新搭建在此目录下**，与原项目完全独立，两边不共享代码、不互相修改。

SillyTavern 是一个面向高级用户的 LLM 前端（v1.18.0，AGPL-3.0），后端使用 Node.js/Express，前端使用原生 HTML/CSS/JavaScript。

**重构目标**：前后端分离，后端迁移到 TypeScript + 分层架构（Controller → Service → Repository），前端使用 React 19 全新搭建。

## 新旧项目关系

```
<原项目目录>/SillyTavern/    ← 原项目（不动）
  ├── src/                    ← 旧后端代码
  ├── public/                 ← 旧前端（重构期间仍使用此前端）
  └── data/                   ← 共享数据（新后端只读）

<本项目目录>/SimpleTavern/   ← 新项目（前后端分离）
  ├── backend/                ← TypeScript 后端
  │   └── src/                ← 后端源码
  ├── frontend/               ← React 19 前端
  │   └── src/                ← 前端源码
  ├── admin/                  ← 管理后台
  │   └── src/                ← 管理后台源码
  └── refactor/               ← 规划文档
```

> ⚠️ **注意**：上述路径为结构示意，实际路径因开发环境而异（macOS: `/Users/linda/code/`，Windows: `D:\Coding\`，生产服务器: `/opt/simpletavern/`）。文档中的命令示例请替换为实际路径。

**关键约定**：
- 后端独立运行在 **8001 端口**（原项目 SillyTavern 在 8000）
- 前端运行在 **3000 端口**
- 管理后台运行在 **3002 端口**
- 原项目的 `data/` 目录作为共享数据源，新项目**只读**原有数据格式
- 角色卡 PNG 与 JSON 完全兼容原 SillyTavern（V1/V2/V3）

## 开发环境

开发环境使用 **Docker Compose** 部署在本机，三个服务各自运行在独立容器中：

```
SimpleTavern/
  ├── backend/    → simple-tavern-backend    (端口 8001)
  ├── frontend/   → simple-tavern-frontend   (端口 3000)
  ├── admin/      → simple-tavern-admin      (端口 3002)
  ├── .env        → 共享环境变量（LLM 配置等）
  └── docker-compose.yml
```

另有原项目 SillyTavern 的容器 `sillytavern`（端口 8000），当前处于 **Paused** 状态。

## 生产环境测试帐号
- 用户名：lzx
- 密码：Asdf@1234

### 常用 Docker 命令

```bash
# 启动全部服务
docker compose up -d

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f admin

# 重启单个服务
docker compose restart backend

# 停止全部服务
docker compose down

# 重新构建并启动（代码变更后）
docker compose up -d --build
```

### 容器健康状态

| 容器 | 端口 | 健康检查 | 状态 |
|------|------|----------|------|
| simple-tavern-backend | 8001 | `wget http://127.0.0.1:8001/version` | ✅ healthy |
| simple-tavern-frontend | 3000 | 无 | ✅ running |
| simple-tavern-admin | 3002 | 无 | ✅ running |

> ⚠️ **注意**：健康检查必须使用 `127.0.0.1` 而非 `localhost`，因为容器内 `localhost` 可能解析到 IPv6 `::1` 导致连接失败。

### 数据挂载

backend 容器挂载的目录：

| 宿主路径 | 容器路径 | 用途 |
|---------|---------|------|
| `${SIMPLE_TAVERN_DATA_ROOT}` | `/data` | 主数据目录（角色卡/聊天记录/用户数据） |
| `/home/ubuntu/code/ugirl_craw/output` | `/ugirl_data:ro` | ugirl 批量导入数据（只读） |

- 角色卡：`/data/<user>/characters/`
- 聊天记录：`/data/<user>/chats/<character>/`
- 用户数据：`/data/default-user/`

### 本地开发（非 Docker）

也可以不用 Docker，直接在本机运行（适合频繁修改代码的场景）：

```bash
# === 一键启动脚本 ===
./start-dev.sh

# === 或手动分别启动 ===
# 终端 1: 后端（tsx watch 热重载）
cd backend && npm run dev

# 终端 2: 前端（Vite dev server）
cd frontend && npm run dev
```

### 构建命令

```bash
# === 后端 ===
cd backend
npm install
npm run dev                  # tsx watch 热重载
npm run build                # tsc 编译（tsconfig: strict, NodeNext）
npm run start                # 无 watch 启动

# === 前端 ===
cd frontend
npm install
npm run dev                  # Vite 开发服务器
npm run build                # Vite 构建
npm run preview              # Vite 预览构建产物
npm run lint                 # tsc --noEmit 类型检查

# === 管理后台 ===
cd admin
npm install
npm run dev                  # Vite 开发服务器
npm run build                # tsc --noEmit && vite build
npm run preview              # Vite 预览构建产物
npm run lint                 # tsc --noEmit 类型检查
```

## 配置

### 环境变量（backend/.env）

```bash
# 数据目录（默认指向原 SillyTavern 的 data 目录）
SIMPLE_TAVERN_DATA_ROOT=/path/to/data

# 日志级别：debug | info | warn | error
LOG_LEVEL=info

# 当前活跃 LLM（对应 llm_0 / llm_1 等序号）
SIMPLE_TAVERN_ACTIVE_LLM=llm_0

# Google OAuth 配置（生产环境必需）
SIMPLE_TAVERN_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
SIMPLE_TAVERN_GOOGLE_CLIENT_SECRET=your-google-client-secret

# 前端 Google Client ID（Vite 环境变量）
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# 多 LLM 配置，按序号扩展
SIMPLE_TAVERN_LLM_0_BASE_URL=https://api.xxx.com/v1
SIMPLE_TAVERN_LLM_0_MODEL=model-name
SIMPLE_TAVERN_LLM_0_API_KEY=sk-xxx
SIMPLE_TAVERN_LLM_0_NAME=MyProvider
SIMPLE_TAVERN_LLM_1_BASE_URL=...
```

配置优先级：CLI 参数 > 环境变量 > config.yaml（从原项目读取）> 默认值。

config.yaml 中的 port 会自动 +1（原项目 8000 → 新后端 8001）。

## 后端架构

### 分层结构

```
server.ts ← app.ts ← modules/*/
  ├── controller/     ← 路由处理，req/res 处理，调用 service，错误转发给 next(err)
  ├── service/        ← 纯函数，无副作用，接收目录路径等上下文参数
  ├── repository/     ← 文件 I/O 封装（PNG 角色卡、JSONL 聊天、用户持久化）
  ├── routes/         ← Express Router 定义，关联到 controller 方法
  ├── validator/      ← 输入验证（角色数据校验）
  └── parser/         ← 格式解析（PNG 角色卡读取）
```

### 其他后端目录

| 目录 | 文件 | 职责 |
|------|------|------|
| **common/** | `errors.ts`, `result.ts`, `logger.ts`, `utils.ts` | 公共工具：错误层次、Result 模式、日志、通用工具函数 |
| **config/** | `env.ts`, `index.ts` | 环境变量加载、配置聚合 |
| **infrastructure/storage/** | `disk-cache.ts` | `MemoryLimitedMap<V>` — 内存受限的 LRU Map，用于缓存场景 |
| **data/** | `seed-characters.json` | 种子角色数据（内置角色，用于发现页展示） |
| **types/** | `api.types.ts`, `config.types.ts`, `models.types.ts`, `declarations.d.ts` | 全局 TypeScript 类型定义 |
| **shared/middleware/** | `cors.ts`, `error-handler.ts`, `auth-guard.ts`, `request-context.ts` | 共享中间件 |

### TypeScript 配置

`backend/tsconfig.json` 关键配置：

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  }
}
```

### 代码约定

- **Controller**: try/catch 包裹，成功调用 `res.json()`，失败调用 `next(err)`，由全局 `errorHandler` 统一处理
- **Service**: 纯导出函数（非 class），直接接收 `charactersDir`、`chatsDir` 等路径参数
- **Repository**: 文件系统操作的唯一入口
- **Result 模式**（`common/result.ts`）: `Result<T, E>` 类型用于需要显式处理成功/失败的场景，分为 `Ok` 和 `Err`，替代隐式 throw/catch
- **错误层次**（`common/errors.ts`）: `AppError` 基类 → `NotFoundError`(404) / `BadRequestError`(400) / `UnauthorizedError`(401) / `ForbiddenError`(403) / `ConflictError`(409) / `TooManyRequestsError`(429)

### 认证机制

- Cookie-session 认证（非 JWT，使用 `cookie-session` 包）
- `auth-guard.ts` 提供两个中间件：`requireLogin`（检查 session.handle）和 `requireAdmin`（额外检查 session.admin）
- 路由分为**公开**（注册在 `requireLogin` 之前）和**私有**（注册在之后）
- 公开路由示例：登录、注册、角色发现、AI 聊天、收藏、用户角色列表、聊天线程、角色导入

#### Cookie Secret 持久化机制

Session 密钥不是硬编码或随机生成的，而是持久化存储：

- 密钥存储位置：`${dataRoot}/cookie-secret.txt`
- 首次启动时若文件不存在，随机生成密钥并写入文件
- 后续启动从文件读取，确保重启后 session 不失效
- Session name 格式：`session-<sha256前8位>`（依赖密钥哈希，保证唯一性）

### 数据存储

| 数据类型 | 存储方式 | 位置 |
|---------|---------|------|
| 用户 | node-persist (JSON key-value) | `dataRoot/default-user/` |
| 角色 | PNG 角色卡（嵌入 JSON） | `dataRoot/<user>/characters/` |
| 聊天 | .jsonl 文件（每行一个 JSON） | `dataRoot/<user>/chats/<character>/` |
| 设置 | JSON 文件 | `dataRoot/<user>/settings.json` |
| 评价 | JSON 文件（按角色类型分文件） | `dataRoot/reviews/` |

#### 评价系统存储

评价数据按角色类型分三个独立文件存储：

```
dataRoot/reviews/
  ├── seed-reviews.json       ← 种子角色评价（key: 角色 id）
  ├── imported-reviews.json   ← 导入 PNG 角色评价（key: 文件名）
  └── png-reviews.json        ← 用户 PNG 角色卡评价（key: handle/characters/filename.png）
```

#### JSONL 聊天文件数据结构

```typescript
// 每个 .jsonl 文件的结构（首行为 ChatHeader，后续为 ChatMessage）
interface ChatHeader {
  chat_metadata: { integrity?: string };
  user_name: string;
  character_name: string;
}
interface ChatMessage {
  name: string;
  is_user: boolean;
  send_date: string;
  mes: string;
  extra?: unknown;
  swipes?: string[];
  swipe_id?: number;
}
```

### 模块清单

| 模块 | 文件 | 职责 |
|------|------|------|
| **auth** | `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`, `google.service.ts` | 登录/登出/密码恢复/管理员用户管理/Google OAuth |
| **users** | `users.repository.ts`, `users.service.ts`, `favorites.controller.ts`, `favorites.routes.ts` | 用户数据层、收藏、设置 |
| **characters** | `characters.controller.ts`, `characters.service.ts`, `characters.repository.ts`, `characters.validator.ts`, `characters.parser.ts`, `characters.importer.ts`, `characters.ugirl-importer.ts`, `characters.user.service.ts`, `characters.public.routes.ts`, `characters.public.import.routes.ts`, `admin-characters.controller.ts`, `admin-characters.routes.ts`, `discover.controller.ts`, `discover.routes.ts`, `seed.service.ts`, `reviews.repository.ts` | 角色 CRUD、PNG 角色卡读写、导入/导出、用户发布、发现/种子角色（种子数据来自 `data/seed-characters.json`）、ugirl 批量导入、评价系统 |
| **chats** | `chats.controller.ts`, `chats.service.ts`, `chats.repository.ts`, `chats.public.routes.ts`, `chats.types.ts` | 聊天读写、JSONL 文件操作、路径安全检查 |
| **backends** | `chat-completions/`, `llm-config.ts`, `types.ts` | AI 聊天补全（OpenAI-compatible）、LLM 配置、多 provider 支持 |
| **worlds** | `worlds.routes.ts`, `worlds.service.ts`, `admin-worlds.controller.ts`, `public-worlds.controller.ts` | 世界书管理（管理员CRUD/用户端列表） |
| **infrastructure** | `infrastructure/storage/disk-cache.ts` | 基础设施（内存受限 Map 工具类 `MemoryLimitedMap<V>`） |
| **data** | `data/seed-characters.json` | 种子角色数据（内置角色，随代码分发） |

#### ugirl 角色批量导入子系统

`characters.ugirl-importer.ts` 提供从 ugirl 爬虫 JSON 文件批量导入角色的功能：

- 支持多种图片格式（`.png`/`.jpg`/`.jpeg`/`.webp`/`.jfif`），使用 `sharp` 自动转换为 PNG
- 通过 **magic bytes** 检测真实图片格式（而非依赖扩展名）
- 并发处理（`CONCURRENCY = 10`）：并行加载头像 + 串行创建角色文件
- 将 ugirl 特有元数据写入角色 `extensions`：`ugirl_id`、`ugirl_popularity`、`ugirl_rating_avg`、`ugirl_radar_tier`
- 导入数据源：容器内 `/ugirl_data`（由 `docker-compose.yml` 以只读方式挂载）

#### 角色数据类型

角色 JSON 包含以下核心结构（V2/V3 格式）：

```typescript
interface CharacterBookEntry {
  name: string;
  entries: CharacterBookEntryItem[];   // 角色内嵌世界书（Character Book）
}
```

### 共享中间件

| 中间件 | 位置 | 功能 |
|--------|------|------|
| CORS | `shared/middleware/cors.ts` | CORS 配置 |
| 错误处理 | `shared/middleware/error-handler.ts` | 统一错误响应格式 `{ error, message }` |
| 认证守卫 | `shared/middleware/auth-guard.ts` | requireLogin / requireAdmin |
| 请求上下文 | `shared/middleware/request-context.ts` | 请求追踪 |

### 后端性能优化

- **compression** 中间件：启用 gzip 压缩（SSE 路径 `/api/chat/stream` 自动跳过压缩）
- **Cache-Control 头**：为特定端点设置缓存策略
  - `/version` → `max-age=3600`（1 小时）
  - `/api/discover` → `max-age=300`（5 分钟）
  - `/api/chat/providers` → `max-age=600`（10 分钟）

### 后端关键依赖

| 依赖 | 用途 |
|------|------|
| `helmet` | HTTP 安全头 |
| `csrf-sync` | CSRF 防护 |
| `rate-limiter-flexible` | 请求限流 |
| `archiver` | 文件压缩（角色导出） |
| `multer` | 文件上传 |
| `google-auth-library` | Google OAuth 认证 |
| `cookie-session` | Cookie-based 会话 |
| `compression` | gzip 压缩 |
| `node-persist` | 用户数据持久化（JSON key-value） |
| `png-chunk-text` / `png-chunks-extract` | PNG 角色卡 JSON 读写 |
| `crc` | PNG 数据块 CRC 校验 |
| `sharp` | 图片格式转换（ugirl 导入时转 PNG） |
| `sanitize-filename` | 文件名安全处理 |
| `yaml` | config.yaml 解析 |
| `chalk` | 日志着色 |
| `@google/generative-ai` | Google Gemini API 集成 |

## 前端架构

### 技术栈

- **React 19** + TypeScript
- **Vite 6** + `@vitejs/plugin-react`
- **Tailwind CSS v4** + `@tailwindcss/vite`（零配置文件）
- **motion** v12（动画，AnimatePresence 页面切换）
- **lucide-react**（图标）
- **@tanstack/react-query**（服务端状态管理）
- **@tanstack/react-virtual**（虚拟滚动，DiscoverScreen）
- **idb**（IndexedDB wrapper，离线聊天缓存）
- **web-vitals**（Web Vitals 指标采集）

### PWA 配置

项目实现了完整的 PWA（渐进式 Web 应用）支持：

- **manifest.json**：`name: "Yuzu AI — Neon Frontier"`，`short_name: "Yuzu AI"`
- `display: "standalone"` + `display_override: ["standalone", "minimal-ui"]`
- `orientation: "portrait"`，`lang: "zh-CN"`
- 8 种尺寸图标（72×72 到 512×512）
- `categories: ["entertainment", "social", "lifestyle"]`
- **Service Worker**：`frontend/public/sw.js`（见下方专节）

### 路由

无 react-router。手动路由，基于 `ScreenId` 枚举在 `App.tsx` 中做条件渲染，使用 `AnimatePresence` 实现页面切换动画。

```
App.tsx ← 14 个 Screen 组件（React.lazy 懒加载）
  ├── WelcomeScreen / LoginScreen（EmailLoginScreen） / RegisterScreen
  ├── DiscoverScreen / CharacterDetailScreen
  ├── ChatScreen（AI 对话）
  ├── CreateChoiceScreen / CreateCharacterScreen
  ├── MessageCenterScreen / ProfileScreen
  ├── MyCharactersScreen / MyFavoritesScreen
  ├── SettingsScreen / HelpFeedbackScreen
```

> **注意**：`ScreenId.EMAIL_LOGIN` 对应的组件文件名为 `LoginScreen.tsx`（不是 `EmailLoginScreen.tsx`）。

### 数据流

- 使用 `useState` 管理应用状态（characters, favoriteIds, chatThreads）
- `useEffect` 在挂载时从后端加载数据，使用 `Promise.all` 并行请求
- 对后端 API 调用使用 optimistic UI updates + rollback 模式
- `App.tsx` 作为唯一状态管理组件，子组件通过 props 接收数据和回调
- **React Query** (`@tanstack/react-query`) 管理服务端状态，支持缓存、重试、后台刷新
- `useMemo` 用于避免重复计算（如 `myCharactersCount`、`allTags`、`filteredCharacters`）
- 功能性 `setState` 避免不必要的依赖项（如 `handleToggleFavorite`）

#### 发送状态管理

AI 消息发送使用专用状态类型：

```typescript
export type SendState = 'idle' | 'sending' | 'streaming' | 'error';
export interface CharacterSendState { state: SendState; }
```

### 前端性能优化

- **代码分割**：14 个 Screen 组件使用 `React.lazy` + `Suspense` 懒加载
- **图片懒加载**：`LazyImage` 组件（Intersection Observer），所有角色头像使用 `LazyImage`
- **虚拟滚动**：DiscoverScreen 使用 `@tanstack/react-virtual` 处理长列表
- **IndexedDB 离线缓存**：`chatCache.ts` 使用 `idb` 缓存聊天数据（DB: `simpletavern-cache`）
- **数据埋点**：`analytics.ts` 批量队列上报（10s 定时发送），集成 Web Vitals
- **Service Worker 缓存**（见下方专节）
- **动画优化**：页面切换移除 x 平移，缩短动画时长
- **品牌启动画面**：`SplashScreen` 组件（entering/active/exiting/done 四阶段状态机）

### 组件结构

```
components/
  ├── Screen 组件（14个页面，React.lazy 懒加载）
  │   ├── WelcomeScreen / LoginScreen / RegisterScreen
  │   ├── DiscoverScreen / CharacterDetailScreen
  │   ├── ChatScreen（AI 对话）
  │   ├── CreateChoiceScreen / CreateCharacterScreen
  │   ├── MessageCenterScreen / ProfileScreen
  │   ├── MyCharactersScreen / MyFavoritesScreen
  │   └── SettingsScreen / HelpFeedbackScreen
  ├── 特殊组件
  │   ├── SplashScreen.tsx（品牌启动画面，四阶段状态机）
  │   └── GoogleCallback.tsx（OAuth 回调弹窗）
  ├── UI 组件
  │   ├── BottomNav.tsx（底部导航）
  │   ├── Toast.tsx（消息提示）
  │   ├── LazyImage.tsx（懒加载图片）
  │   ├── Skeleton.tsx（加载骨架屏）
  │   ├── SwipeableRow.tsx（左滑操作通用组件，含 chatSwipeActions 工厂函数）
  │   └── ErrorBoundary.tsx（错误边界）
  └── hooks/（自定义 Hooks）
      ├── useAuth.ts（认证逻辑）
      ├── useCharacters.ts（角色数据）
      ├── useChat.ts（聊天逻辑）
      ├── useFavorites.ts（收藏管理）
      └── useFormValidation.ts（表单验证）
```

### 其他前端目录

```
src/
  ├── api/               ← API 客户端封装
  │   ├── client.ts      ← fetch 封装 + 认证头
  │   ├── characters.ts  ← 角色 API
  │   ├── chat.ts        ← 聊天 API
  │   ├── users.ts       ← 用户 API
  │   ├── worlds.ts      ← 世界书 API
  │   ├── google-oauth.ts ← Google OAuth
  │   └── index.ts       ← 统一导出
  ├── contexts/          ← React Context
  │   └── AppContext.tsx  ← 全局 Context
  ├── validations/       ← 前端验证
  │   ├── auth.ts        ← 认证表单验证
  │   ├── character.ts   ← 角色表单验证
  │   └── index.ts       ← 统一导出
  ├── utils/             ← 工具函数
  │   ├── chatCache.ts   ← IndexedDB 离线聊天缓存（DB: simpletavern-cache）
  │   ├── analytics.ts   ← 数据埋点（批量队列 + Web Vitals + 10s 定时上报）
  │   └── formatDate.ts  ← 聊天日期格式化（兼容 ISO 8601 和 SillyTavern 格式）
  ├── sw-register.ts     ← Service Worker 注册（生产环境）
  ├── types.ts           ← TypeScript 类型定义（含 SendState）
  └── data.ts            ← 静态数据（FAQ 等）
```

### 自定义 Hooks

所有自定义 Hook 通过 `hooks/index.ts` 统一导出，同时导出 React Query 的 query key 常量：

```typescript
// hooks/index.ts 统一导出
export { useDiscoverCharacters, useMyCharacters, useCreateCharacter, ... } from './useCharacters';
export { useChatThreads, useChatThread, useSendMessage, ... } from './useChat';
export { useLogin, useRegister, useLogout, useCurrentUser, ... } from './useAuth';
export { useFavorites, useAddFavorite, useRemoveFavorite, ... } from './useFavorites';

// React Query key 常量
export { characterKeys, chatKeys, favoriteKeys } from './...';
```

## 管理后台架构

管理后台运行在 **3002 端口**，使用独立的前端应用，与主前端（3000 端口）完全分离。

### 技术栈

- **React 19** + TypeScript
- **Vite 6** + `@vitejs/plugin-react`
- **Tailwind CSS v4** + `@tailwindcss/vite`（零配置文件）
- **react-router-dom** v7（管理后台使用路由库，与主前端手动路由不同）
- **@tanstack/react-query**（服务端状态管理）
- **lucide-react**（图标）
- **zod**（schema 验证）

### 页面结构

```
admin/src/
  ├── App.tsx              ← 应用入口，路由配置
  ├── main.tsx             ← React 挂载点
  ├── types.ts             ← TypeScript 类型定义
  ├── api/
  │   ├── client.ts        ← fetch 封装 + 认证头
  │   └── admin.ts         ← 管理员 API 调用
  ├── hooks/
  │   └── useAdminApi.ts   ← 管理员 API 自定义 Hook
  └── pages/
      ├── Login.tsx        ← 管理员登录
      ├── Dashboard.tsx    ← 仪表盘（数据统计概览）
      ├── Characters.tsx   ← 角色管理（全量查询/编辑/删除）
      ├── Users.tsx        ← 用户管理（创建/删除/禁用/提权）
      ├── Worlds.tsx       ← 世界书管理（CRUD/导入）
      └── Layout.tsx       ← 后台布局（侧边栏导航）
```

### 认证方式

管理员登录后，通过 cookie-session 维持会话，请求时携带认证 cookie。API 请求通过 `api/client.ts` 统一封装，自动附加认证头。

## Service Worker 缓存

前端实现了 Service Worker 缓存方案，文件位于 `frontend/public/sw.js`，注册逻辑在 `src/sw-register.ts`。

- **开发环境自动跳过**：`import.meta.env.DEV` 为 true 时不注册 SW
- **直接注册**：不等待 `load` 事件，组件挂载时立即注册
- **缓存版本号**：`BUILD_VERSION = 'YYYY-MM-DD-N'` 格式，`deploy-prd.sh` 每次部署时自动递增（同一天递增序号，跨天重置为 1）。`CACHE_NAME` 引用 `BUILD_VERSION`，版本号变化触发浏览器更新缓存。

### 缓存策略

| 策略 | 路由 | 效果 |
|------|------|------|
| **Stale-While-Revalidate** | `/api/discover`, `/api/users/me`, `/api/users/settings` | 先返回缓存（瞬间），后台静默更新 |
| **Cache-First** | `/api/chat/providers`, `/api/version` + 所有静态资源（JS/CSS/图片/字体） | 缓存命中直接返回，未命中才请求网络 |
| **Network-First** | `/api/users/favorites`, `/api/users/characters`, `/api/chat/threads` | 优先拿最新数据，网络失败时降级到缓存 |

### 生产环境 Nginx 配置

`sw.js` 需要配置 `no-cache` 头，确保浏览器总能获取最新版 SW：

```nginx
location /sw.js {
    proxy_pass http://127.0.0.1:3000/sw.js;
    proxy_http_version 1.1;
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";
}
```

## 已实现的 API 端点

| 分类 | 端点 | 说明 |
|------|------|------|
| **公开** | `GET /csrf-token` `GET /version` | 基础端点 |
| **认证** | `POST /api/users/login\|register\|list\|recover-*\|google-login` | 登录/注册/用户列表/密码恢复/Google OAuth |
| **用户** | `POST /api/users/logout\|change-*` `GET /api/users/me` | 登出/改密码/改名/改头像/获取当前用户 |
| **管理员** | `POST /api/users/create\|delete\|disable\|enable\|promote\|demote` | 用户管理 |
| **收藏** | `GET/POST /api/users/favorites` `DELETE /api/users/favorites/:id` | 收藏系统 |
| **角色** | `POST /api/characters/all\|get\|create\|edit\|delete\|rename\|duplicate\|export\|import\|chats\|publish` | 角色 CRUD + 导入导出 + 复制 |
| **角色头像** | `GET /api/characters/avatar/:filename` | 获取角色 PNG 头像（公开，302 重定向） |
| **发现** | `GET /api/discover` `GET /api/discover/:id` `POST /api/discover/:id/reviews` | 种子角色 + 评价系统 |
| **世界书** | `POST /api/worlds/list` | 用户端世界书列表（需登录） |
| **管理-角色** | `POST /api/characters/admin-*` | 管理员角色管理（全量查询/编辑/删除） |
| **管理-世界书** | `POST /api/worlds/admin-*` | 管理员世界书管理（CRUD/导入） |
| **聊天** | `POST /api/chats/save\|get\|rename\|delete\|export\|import` `POST /api/chats/group/*` | 聊天 CRUD + 群组 |
| **AI 聊天** | `POST /api/chat` `POST /api/chat/stream` `GET /api/chat/providers` | 角色扮演聊天（多 LLM）+ SSE 流式输出 |
| **线程** | `GET /api/chat/threads` `GET /api/chat/threads/:id` | 聊天历史 |
| **用户角色** | `GET /api/users/characters` `GET /api/users/png-characters` `POST /api/users/characters/edit\|delete` | 用户创建的角色列表（含 PNG 头像版）+ 编辑/删除 |
| **设置** | `GET/POST /api/users/settings` | 用户设置读写 |
| **埋点** | `POST /api/analytics/events` | 前端行为数据上报（公开端点） |

## 重构进度

| 阶段 | 内容 | 状态 |
|------|------|------|
| 0 | 基础设施搭建（TypeScript/Express/Config） | ✓ 完成 |
| 1 | 认证与用户模块（登录/注册/密码管理） | ✓ 完成 |
| 2 | 角色与聊天模块（CRUD + PNG 角色卡） | ✓ 完成 |
| 3 | AI 后端模块（OpenAI-compatible 多 LLM 支持） | ✓ 完成 |
| 4 | 用户功能模块（收藏/发布角色/聊天线程/设置） | ✓ 完成 |
| 4.5 | 前端性能优化（代码分割/SW缓存/图片懒加载/虚拟滚动） | ✓ 完成 |
| 4.6 | 前端 UX 优化（SplashScreen/SwipeableRow/离线缓存/埋点/PWA完善） | ✓ 完成 |
| 5 | 图像与语音模块 | 待开始 |
| 6 | 收尾与清理 | 待开始 |

## 生产环境部署

### 服务器信息
- **域名**: https://chat.hhxxttxs.icu
- **服务器 IP**: 129.146.164.152 (Oracle Cloud)
- **部署目录**: `/opt/simpletavern`
- **部署脚本**: `deploy-prd.sh`（仓库根目录，自动递增 SW 版本号）

### 部署流程
```bash
# 1. 本地提交代码到 GitHub
git add -A
git commit -m "feat: xxx"
git push origin main

# 2. 服务器上运行一键部署脚本
ssh ubuntu@129.146.164.152
cd /opt/simpletavern && sudo bash deploy-prd.sh
```

> ⚠️ **注意**：部署脚本会自动拉取代码、备份数据、递增 SW 版本号、重建容器、检查健康状态。

### 部署脚本功能
- 备份数据目录及环境变量
- 自动递增 SW 缓存版本号（`BUILD_VERSION`，格式 `YYYY-MM-DD-N`）
- 从 GitHub 拉取最新代码
- 恢复环境变量配置和备份数据
- 重建并启动 Docker 容器（支持 `--skip-build` 跳过构建）
- 多端点健康检查 + 失败回滚指引

### Docker 服务
| 容器 | 端口 | 说明 |
|------|------|------|
| simple-tavern-backend | 8001 | TypeScript/Express API |
| simple-tavern-frontend | 3000 | React 前端 (Nginx) |
| simple-tavern-admin | 3002 | 管理后台 |

### 环境变量配置
生产环境敏感信息通过 `.env` 文件配置（不提交到 Git）：

**backend/.env:**
```bash
SIMPLE_TAVERN_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SIMPLE_TAVERN_GOOGLE_CLIENT_SECRET=your-client-secret
```

**frontend/.env:**
```bash
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

> ⚠️ **注意**: Google OAuth 配置需要在 [Google Cloud Console](https://console.cloud.google.com/) 创建 OAuth 2.0 客户端 ID，并授权回调地址 `https://chat.hhxxttxs.icu/auth/callback`

### Nginx 配置
- 配置文件: `/etc/nginx/sites-available/chat.hhxxttxs.icu`
- SSL 证书: `/etc/letsencrypt/live/chat.hhxxttxs.icu/`
- 前端代理: `/` → `127.0.0.1:3000`
- API 代理: `/api/` → `127.0.0.1:8001`
- SW 不缓存: `/sw.js` → `no-cache, no-store, must-revalidate`

### 常用命令
```bash
# 查看容器状态
docker ps

# 查看后端日志
docker logs -f simple-tavern-backend

# 重启服务
cd /opt/simpletavern && docker compose restart

# 手动拉取最新代码
cd /opt/simpletavern && sudo git pull origin main
```

## 参考文档

- `refactor/architecture-reference.md` — 原项目架构问题分析 + 完整 API 接口清单
- `refactor/migration-plan.md` — 完整重构计划（目标架构、6 阶段迁移、文件变更清单）
- `refactor/api-reference.md` — 新后端 API 文档（含请求/响应格式、示例、数据模型）
- `frontend-ux-optimization-spec.md` — 前端 UX 优化规格文档
- `knowledge.md` — 项目补充知识（开发过程中积累的额外约定）
