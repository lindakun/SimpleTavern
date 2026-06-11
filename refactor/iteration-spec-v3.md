# SimpleTavern 迭代需求规划 v3

> **版本**：v3.0  
> **创建日期**：2026-06-11  
> **审查范围**：全量代码审查（backend 37 文件 + frontend 26 文件 + admin 6 文件 + infra + 已有文档）  
> **文档目的**：基于代码实际状态发掘高价值优化，排除已落地功能，聚焦新发现问题  

---

## 审查摘要

### 与 v2（2026-06-10）的差异核实

v2 文档中标记为缺失/未实现的部分功能，经代码审查确认已落地：

| v2 编号 | v2 描述 | 实际状态 | 证据 |
|---------|---------|----------|------|
| B-01~B-08 | 变量插值Bug | ✅ 已修复 | git log 有相应 fix commit，代码中已含正确变量引用 |
| N-01 | Markdown渲染 | ✅ 已实现 | ChatScreen 使用 react-markdown + remark-gfm |
| N-02 | first_mes 字段 | ✅ 已实现 | ChatScreen greeting 区使用 character.first_mes 并做 {{char}}/{{user}} 替换 |
| N-03 | 停止生成按钮 | ✅ 已实现 | ChatScreen 发送按钮在 streaming 状态变为 Square 图标，调用 onStopGeneration |
| O-01 | 虚拟滚动 | ✅ 已实现 | ChatScreen 使用 @tanstack/react-virtual |
| O-02 | 深链接/分享 | ✅ 已实现 | App.tsx 路由 /character/:id，CharacterDetailScreen 有 Share2 按钮 |
| O-03 | 时间戳格式 | ✅ 已实现 | ChatScreen 使用 formatChatDate |
| O-04 | 骨架屏 | ✅ 已实现 | DiscoverScreen 使用 CharacterCardSkeleton |
| O-05 | 字数限制 | ✅ 已实现 | CreateCharacterScreen Field 组件含 maxChars + 字符统计 |
| O-06 | 消息编辑 | ✅ 已实现 | ChatScreen 有 Pencil 图标，支持 inline 编辑 + 重新生成 |
| F-01 | 搜索框 | ✅ 已实现 | MyCharactersScreen 有工作搜索框 |
| F-02 | 用户头像 | ✅ 已实现 | ChatScreen 根据 userHandle hash 动态生成头像颜色 |
| F-03 | 下拉刷新 | ✅ 已实现 | DiscoverScreen 有完整的 pull-to-refresh 实现 |
| F-05 | 连接测试 | ✅ 已实现 | SettingsScreen 有 testConnection 按钮 |

**结论**：v2 文档中所有 P0/P1/P2 及大部分 P3 需求已落地。以下为新发现的问题。

---

### 新发现问题概览

| 优先级 | 数量 | 类别 |
|--------|------|------|
| P0 — 安全/稳定性 | 4 项 | 硬编码路径、CSP关闭、CSRF缺失、模块状态泄漏 |
| P1 — 架构债务 | 5 项 | 上帝组件、重复状态管理、死代码、any 滥用、无测试 |
| P2 — 功能缺失 | 6 项 | 分页、头像上传、通知、后端搜索、邮件、面板数据 |
| P3 — 体验/性能 | 5 项 | 流清理、请求日志、错误响应一致性、离线降级、部署安全 |

---

## 一、P0 — 安全与稳定性（立即修复）

### S-01 硬编码绝对路径导致跨环境崩溃

**文件**：`backend/src/app.ts` ≈ L104  
**现象**：`const staticDir = '/Users/linda/code/SillyTavern/public'` 硬编码 macOS 开发机路径。部署到 Linux 服务器或他人机器时，`fs.existsSync(staticDir)` 返回 false（静默跳过），但若路径碰巧存在会产生意外行为。  
**风险**：高。生产环境可能意外暴露非预期目录的静态文件。  
**修复方案**：
```ts
// 移除静态文件挂载，或改为环境变量控制
const staticDir = process.env.SIMPLE_TAVERN_STATIC_DIR;
if (staticDir && fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
}
```

---

### S-02 Helmet CSP 完全禁用导致 XSS 风险敞口

**文件**：`backend/src/app.ts` L43  
**现象**：`app.use(helmet({ contentSecurityPolicy: false }))` 完全关闭了 CSP 保护。虽然 NSA 级别的 CSP 可能影响前端功能，但完全关闭意味着失去所有 XSS 防护。  
**修复方案**：
```ts
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // React 需要
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https:"],
        },
    },
}));
```

---

### S-03 CSRF 中间件未注册

**文件**：`backend/src/app.ts`，依赖 `backend/package.json`  
**现象**：`csrf-sync` 已在 package.json 中声明，但 `app.ts` 中未注册 CSRF 中间件。`GET /csrf-token` 端点返回 `token: config.disableCsrf ? 'disabled' : 'enabled'`，但实际上无任何中间件校验 CSRF token。所有 POST/PUT/DELETE 请求无 CSRF 保护。  
**风险**：高。攻击者可构造跨站请求执行状态变更操作（如删除角色、修改设置）。  
**修复方案**：注册 `csrf-sync` 中间件，或在 Nginx 层添加 `SameSite=Strict` cookie 策略作为纵深防护。

---

### S-04 useAuth.ts 模块级可变状态导致多实例/HMR 数据错乱

**文件**：`frontend/src/hooks/useAuth.ts` L12-16  
**现象**：
```ts
let currentUser: { handle: string; name: string; email?: string } | null = null;
export function setCurrentUser(user: typeof currentUser) { currentUser = user; }
export function getCurrentUser() { return currentUser; }
```
这是模块级可变状态，存在以下问题：
- React 18 StrictMode 双次挂载时可能被意外清空
- Vite HMR 热更新后状态丢失但组件未重新挂载
- 多 Tab 共享时无同步机制
- 与 React Query 缓存 (`['user', 'me']`) 完全独立，产生两份"真相"  
**修复方案**：移除模块级 `currentUser`，统一使用 React Query 的 `queryClient.getQueryData(['user', 'me'])` 作为唯一数据源。

---

## 二、P1 — 架构债务（本月内解决）

### A-01 App.tsx 上帝组件（560+ 行）

**文件**：`frontend/src/App.tsx`  
**现象**：App 组件承载了全部业务逻辑：
- 全部 API 调用（角色、聊天、用户、收藏）
- 全部状态管理（Zustand store 操作、React Query 操作）
- 全部事件处理（sendMessage、editMessage、deleteMessage、publishCharacter 等 15+ 回调）
- 全部路由定义
- 全部数据加载逻辑

**后果**：
- 任何修改都触碰这个文件，merge conflict 高频
- 无法对单个功能做单元测试
- 新成员理解成本极高
- `handleSendMessage` 单函数超过 100 行，包含 SSE 流处理、状态管理、错误处理、缓存更新

**建议重构方向**（分阶段）：
1. 提取 `useChatFlow` hook — 封装 sendMessage + streaming + stop + edit + delete 全部聊天逻辑
2. 提取 `useCharacterManagement` hook — 封装 publish/update/delete/copy/privacy 全部角色操作
3. 提取 `useAppNavigation` hook — 封装路由守卫 + 初始化路由 + 认证回调
4. 将路由配置提取为独立文件 `routes.tsx`
5. App.tsx 仅保留：providers 组装 + route render + hook 粘合（目标 < 150 行）

---

### A-02 三套状态管理并存导致数据不一致

**现象**：同一份"角色列表"数据同时存在于三个系统：
1. **Zustand** `useCharacterStore.characters` — App.tsx 直接 `setCharacters()`
2. **React Query** `useDiscoverCharacters()` / `useMyCharacters()` — hooks 层定义的 query
3. **手动 useState** `AppContext.characters`（但 AppContext 未被使用 → 死代码）

**后果**：
- `App.tsx` 使用 `characterApi.getDiscoverCharacters().then(data => useCharacterStore.getState().setCharacters(data))` 裸调用 API，绕过了 React Query 的缓存/去重/重试机制
- 角色更新后需手动同步 Zustand store，容易遗漏

**修复方案**：
- 统一使用 React Query 管理服务端状态（characters、favorites、chat threads）
- Zustand 仅保留纯 UI 状态（editingCharacter、sendStates、loadedChats）
- 删除 AppContext（见 A-03）

---

### A-03 AppContext.tsx 是完全死代码

**文件**：`frontend/src/contexts/AppContext.tsx`（约 140 行）  
**现象**：`AppProvider` 定义了完整的 Context 状态管理体系（navigation、user、characters、chats、favorites），但：
- `App.tsx` 未使用 `AppProvider` 包裹
- 没有任何组件调用 `useApp()` hook
- 所有功能已由 Zustand + React Query + 手动 state 替代

**修复方案**：直接删除 `AppContext.tsx` 文件，去除误导。

---

### A-04 `any` 类型过度使用（32 处）

**分布**：
- backend/config/index.ts: `(yaml as any)` 多处
- backend/modules/chats/: `any[]` 作为聊天数据类型
- backend/modules/characters/discover.controller.ts: `any[]` 返回类型
- backend/modules/worlds/admin-worlds.controller.ts: `(err: any)` 
- backend/shared/middleware/cors.ts: `(_req: any, _res: any, next: any)`

**风险**：丧失 TypeScript 的类型安全优势，重构时易引入 bug。  
**修复方案**（分批）：
1. 为 `yaml` 解析结果定义 `YamlConfig` interface 替代 `(yaml as any)`
2. 聊天数据定义 `StoredChatMessage` interface
3. Express 中间件使用 `Request`/`Response`/`NextFunction` 正确类型
4. 错误捕获统一使用 `unknown` 并做类型收窄

---

### A-05 零测试覆盖

**现状**：全项目无任何测试文件（`*.test.ts` / `*.spec.ts` / `__tests__` 均不存在）。  
**风险**：每次部署依赖人工验证，回归问题无法自动发现。

**建议分阶段建立**：
1. **阶段一（后端核心）**：auth.service（登录/密码哈希）、characters.validator（角色校验）
2. **阶段二（后端 API）**：supertest 集成测试覆盖 /api/discover、/api/chat/stream
3. **阶段三（前端）**：Vitest + React Testing Library 测试关键 hook（useFavorites 乐观更新）

---

## 三、P2 — 功能缺失（季度内迭代）

### F-01 发现页无分页 — 一次性加载全部角色

**文件**：`backend/src/modules/characters/discover.controller.ts`  
**现象**：`GET /api/discover` 返回所有种子角色 + 导入角色 + 公开角色，无 offset/limit 参数。角色数量随导入增加而单调增长，响应体越来越大。  
**需求**：
1. 支持 `?offset=0&limit=20` 分页参数
2. 响应增加 `total` 和 `hasMore` 字段
3. 前端 DiscoverScreen 实现无限滚动加载（Intersection Observer）
4. 搜索/标签筛选优先客户端处理当前页，超出范围时加服务端参数

---

### F-02 头像上传无后端存储

**文件**：`frontend/src/components/CreateCharacterScreen.tsx`  
**现象**：角色头像通过 `FileReader.readAsDataURL()` 转为 base64 内嵌在角色 JSON 中。头像数据直接写入 PNG 角色卡的 JSON 字段，导致：
- PNG 文件体积膨胀（base64 比原始二进制大约 33%）
- 无法利用 CDN/缓存优化图片加载
- 角色卡在不同系统间传输时体积过大

**需求**：
1. 后端新增 `POST /api/characters/avatar/upload`（multipart，返回 avatar URL）
2. 前端上传头像后使用返回的 URL 而非 base64
3. 已有 base64 头像的角色卡保持兼容读取
4. 头像支持 CDN 缓存策略（immutable + hash）

---

### F-03 消息中心无真实通知数据

**文件**：`frontend/src/components/MessageCenterScreen.tsx`  
**现象**：消息中心显示的是聊天线程列表（`chatThreads`），无任何系统通知（新评价、角色更新、点赞等）。  
**需求**：
1. 后端新增 `GET /api/notifications` 端点（返回未读通知列表）
2. 通知类型：新评价、角色被收藏、系统公告
3. 前端 MessageCenterScreen 顶部分区：通知区 + 聊天列表区
4. TabBar 消息图标显示未读角标数字

---

### F-04 无后端消息搜索

**文件**：`frontend/src/components/ChatScreen.tsx`  
**现象**：聊天搜索完全在客户端执行（`messages.forEach`），只能搜索已加载到内存的消息。历史消息需先点击加载才能被搜索到。  
**需求**：
1. 后端新增 `GET /api/chat/search?q=keyword&characterId=xxx`（全文搜索 JSONL 文件）
2. 搜索结果返回匹配消息 + 上下文（前后各 2 条）
3. 前端搜索框输入时 debounce 300ms 调用后端搜索
4. 点击搜索结果跳转到对应消息位置并高亮

---

### F-05 密码恢复无邮件发送能力

**文件**：`backend/src/modules/auth/auth.service.ts` L95  
**现象**：`generateRecoveryCode()` 生成 6 位恢复码但无任何发送机制。注释写"实际应打印到控制台"。  
**需求**：
1. 集成邮件服务（如 SendGrid、Resend）发送密码重置邮件
2. 恢复码有效期 15 分钟
3. 重置页面验证恢复码 + 新密码
4. 或简化方案：管理员手动重置密码

---

### F-06 管理后台仪表盘数据为空/硬编码

**文件**：`admin/src/pages/Dashboard.tsx`  
**现象**：仪表盘页面仅展示静态 UI，无真实统计数据（用户数、角色数、聊天数、日活等）。  
**需求**：
1. 后端新增 `GET /api/admin/stats`（返回用户数、角色数、聊天数、最近注册等）
2. 仪表盘展示关键指标卡片 + 最近注册用户列表
3. 可后续扩展简单的图表（近 7 天活跃趋势）

---

## 四、P3 — 体验与性能优化

### O-01 SSE 流断开时 reader 未释放

**文件**：`backend/src/modules/backends/chat-completions/chat-completions.controller.ts` L81  
**现象**：`chatStream` controller 中，当客户端断开连接时（`req.on('close')`），`reader.releaseLock()` 不会被调用，LLM upstream 连接继续消耗资源直到超时。

```ts
// 当前代码仅在 finally 中 releaseLock，但 while(true) 循环中没有监听客户端断开
```

**修复方案**：
```ts
req.on('close', () => {
    reader.cancel().catch(() => {});
});
```

---

### O-02 后端缺少请求日志

**现象**：`app.ts` 未注册任何请求日志中间件（如 morgan）。排查线上问题时无法追溯请求历史。  
**需求**：
1. 注册简单的请求日志中间件（method + path + status + response time）
2. DEBUG 级别时记录请求体（敏感字段脱敏）
3. 日志输出到 stdout（由 Docker 收集）

---

### O-03 错误响应格式不一致

**现象**：不同 controller 返回的错误格式不统一：
- `auth-guard.ts`: `{ error: 'Unauthorized', message: '...' }` (status 403 而非 401)
- `error-handler.ts`: `{ error: err.code, message: err.message }`
- `chatStream`: `{ error: 'Message is required' }` (缺少 message 字段)
- `chat`: `{ error: err.message }` (缺少 code 字段)  
**需求**：统一为 `{ code: string, message: string }` 格式，auth-guard 返回 401 而非 403。

---

### O-04 前端缺少离线降级提示

**现象**：网络断开时，所有 API 调用直接抛出 "网络连接失败" toast，无任何离线可用功能的提示。实际上 IndexedDB 缓存（chatCache）已实现但未在离线时主动提示用户。  
**需求**：
1. 检测到网络断开时，顶部显示持久化 banner「当前处于离线模式，部分功能不可用」
2. 离线时聊天历史仍可浏览（从 IndexedDB 读取）
3. 网络恢复时自动重新连接并同步数据

---

### O-05 生产环境 Docker 配置安全加固

**文件**：`docker-compose.yml`、`backend/Dockerfile`、`frontend/Dockerfile`  
**现状问题**：
1. Dockerfile 未使用非 root 用户运行（`node:22-alpine` 默认 root）
2. 未设置 `read_only: true` 容器文件系统
3. 未限制容器资源（memory/cpu limits）
4. frontend nginx 配置未隐藏版本号 `server_tokens off;`
5. backend 容器未使用 `--security-opt=no-new-privileges`

---

## 五、优先级矩阵

```
P0（本周必须）：
  S-01 硬编码路径    S-02 CSP关闭    S-03 CSRF缺失    S-04 模块状态泄漏

P1（本月内）：
  A-01 上帝组件拆分  A-02 状态统一    A-03 删除死代码   A-04 any类型   A-05 测试

P2（季度内）：
  F-01 分页    F-02 头像上传    F-03 通知系统
  F-04 后端搜索  F-05 邮件恢复  F-06 面板数据

P3（长期）：
  O-01 SSE清理  O-02 请求日志  O-03 错误格式
  O-04 离线降级  O-05 容器安全
```

---

## 六、与现有文档的关系

| 文档 | 关系 | 说明 |
|------|------|------|
| `iteration-spec.md` | 保持有效 | P0-P4 整体架构规划仍适用 |
| `iteration-spec-v2.md` | **可归档** | 其中所有需求已落地或本文档覆盖 |
| `iteration-plan-privacy-type.md` | 保持有效 | privacyType 计划独立推进 |
| `auth-ux-optimization-spec.md` | 保持有效 | 认证 UX 改造独立推进 |
| **本文档 (v3)** | **新增** | 基于最新代码状态的全量审查结果 |

---

*文档基于全量代码审查生成，审查时间：2026-06-11*
