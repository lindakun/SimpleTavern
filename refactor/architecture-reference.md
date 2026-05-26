# 原项目架构参考

> 生成时间：2026-05-25
> 用途：重构参考，记录原项目的架构问题和 API 接口清单
>
> **说明**：本文档分析的是原项目 `/Users/linda/code/SillyTavern/` 的现状。重构在独立目录 `/Users/linda/code/SimpleTavern/` 中全新搭建，不修改原项目。

---

## 第一部分：架构问题分析

### 1. 前后端未分离

- 前端 `public/script.js` 为 12537 行的巨型文件，作为中央编排器
- 前端直接通过 `fetch()` 调用硬编码 URL 字符串，无统一 API 客户端
- 约 170+ 个端点分散在 ~60 个前端文件中，无集中管理
- 无请求/响应类型校验

### 2. 后端耦合问题

#### 2.1 循环依赖

```
util.js  →  express-common.js  →  util.js
   |              |                    |
   |         imports                imports
   |        getConfigValue         isFirefox
```

- `util.js` 导入 `express-common.js` 的 `isFirefox`
- `express-common.js` 导入 `util.js` 的 `getConfigValue`
- 当前未崩溃是因为 `getConfigValue` 只在函数内调用，不在模块初始化时执行

#### 2.2 跨层依赖

`users.js` 核心模块导入了 3 个 endpoint 模块：
- `endpoints/secrets.js`
- `endpoints/content-manager.js`
- `endpoints/extensions.js`

这违反了分层原则，上层模块依赖了下层模块。

#### 2.3 全局状态

`globalThis` 被滥用为全局变量容器：
- `globalThis.DATA_ROOT` — 被 15+ 文件直接访问
- `globalThis.COMMAND_LINE_ARGS` — 被多处引用

这导致隐式耦合，难以追踪和测试。

#### 2.4 集中路由注册

`server-startup.js` 一个文件导入 50+ 个路由，全部在 `setupPrivateEndpoints()` 函数中注册。任何路由变更都需要修改这个文件。

### 3. 代码臃肿

| 文件 | 行数（约） | 问题 |
|------|-----------|------|
| `src/endpoints/characters.js` | 1000+ | 角色 CRUD + 缓存 + 导入导出 + 头像处理 + 角色卡解析 |
| `src/endpoints/openai.js` | 1000+ | 15+ 个 AI 提供商的图像描述 + OpenAI 代理 |
| `src/endpoints/backends/chat-completions.js` | 2000+ | 27 个 AI 后端的聊天补全 + prompt 转换 + token 计算 |
| `src/endpoints/stable-diffusion.js` | 1000+ | 20+ 个 SD 提供商的图像生成 |
| `src/util.js` | 1300+ | 混杂了配置读取、文件操作、网络请求、格式化等不相关功能 |
| `public/script.js` | 12537 | 前端所有全局状态和事件系统的中心 |

### 4. 模块职责不清

- `util.js` 承担了配置读取、颜色输出、文件操作、HTTP 请求、格式化等完全不相关的职责
- `users.js` 同时处理用户 CRUD、认证、会话管理、文件存储路径、头像管理
- `characters.js` 同时处理角色 CRUD、缓存、缩略图、精灵图、角色卡解析

### 5. 无类型安全

- 纯 JavaScript，全靠 JSDoc 注释提供类型提示
- 无编译时错误检查
- API 请求/响应结构无法在编译时验证

### 6. 中间件链难以维护

`server-main.js` 中的中间件注册顺序是硬编码的：

```
helmet → compression → responseTime → bodyParser → cors(条件) → basicAuth(条件) →
whitelist(条件) → hostWhitelist → accessLog(条件) → cookieSession → setUserData →
CSRF → 静态文件 → 公开API → requireLoginMiddleware → 私有API → multer →
redirectDeprecated → setupPrivateEndpoints → 404
```

中间件顺序错误可能导致安全问题或功能故障，但目前全靠人工维护。

### 7. 依赖关系图

```
server.js (入口)
  └→ command-line.js
       ├→ util.js ←──────┐ (循环)
       └→ config-init.js  │
            ├→ util.js     │
            └→ server-directory.js  (无依赖，安全)

server-main.js
  ├→ util.js (15+ 消费者)
  ├→ constants.js (纯数据)
  ├→ server-directory.js
  ├→ express-common.js ────→ util.js (完成循环)
  ├→ users.js
  │    ├→ constants.js
  │    ├→ util.js
  │    ├→ endpoints/secrets.js (跨层!)
  │    ├→ endpoints/content-manager.js (跨层!)
  │    ├→ endpoints/extensions.js (跨层!)
  │    ├→ express-common.js
  │    └→ server-directory.js
  ├→ webpack-serve.js
  └→ [47 个 endpoint routers...]
```

### 8. 中间件清单 (`src/middleware/`)

| 文件 | 职责 |
|------|------|
| `basicAuth.js` | HTTP Basic 认证 |
| `whitelist.js` | IP 白名单 |
| `hostWhitelist.js` | Host 头验证（防 DNS 重绑定） |
| `accessLogWriter.js` | 访问日志 |
| `multerMonkeyPatch.js` | Multer 补丁 |
| `webpack-serve.js` | Webpack 编译和静态服务 |
| `cacheBuster.js` | 缓存清除 |
| `corsProxy.js` | CORS 代理 |
| `userCss.js` | 用户自定义 CSS |
| `validateFileName.js` | 文件名验证 |

### 9. 统计数据

- **后端路由文件**: 47 个
- **API 端点总数**: ~170+（不含旧版重定向）
- **中间件**: 11 个
- **前端 JS 文件**: 83 个
- **循环依赖**: 1 组（util.js ↔ express-common.js）
- **跨层依赖**: 3 处（users.js → endpoints/*）
- **全局状态变量**: 2 个（DATA_ROOT, COMMAND_LINE_ARGS）

---

## 第二部分：API 接口清单

### 路由注册模式

- **统一前缀**：几乎所有私有 API 使用 `/api/` 前缀
- **例外**：`/thumbnail/`、用户文件服务直接挂在根路径
- **模式**：端点文件通过 `export const router = express.Router()` 导出，由 `src/server-startup.js` 统一 `app.use()` 注册
- **认证分层**：`requireLoginMiddleware` 作为分界线，之前为公开 API，之后为私有 API

### 公开端点（无需认证）

#### `src/endpoints/users-public.js` — 前缀 `/api/users`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/users/list` | 列出所有用户 |
| POST | `/api/users/login` | 用户登录 |
| POST | `/api/users/logout` | 用户登出 |
| POST | `/api/users/register` | 用户注册 |
| POST | `/api/users/change-password` | 修改密码 |
| POST | `/api/users/recover` | 密码恢复请求 |
| POST | `/api/users/recover-step2` | 密码恢复确认 |
| POST | `/api/users/verify-mfa` | MFA 验证 |

#### `server-main.js` 直接定义

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/` | 首页 |
| GET | `/login` | 登录页 |
| GET | `/callback/:source?` | OAuth PKCE 回调 |
| GET | `/csrf-token` | 获取 CSRF token |
| GET | `/version` | 获取版本信息 |
| GET | `/css/user.css` | 用户自定义 CSS |

### 私有端点（需认证）

#### `server-main.js` 直接定义

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/ping` | 心跳/会话续期 |
| ALL | `/proxy/:url(*)` | CORS 代理（条件启用） |

#### `src/users.js` — 前缀 `/`（userDataRouter）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/backgrounds/*` | 背景图文件 |
| GET | `/characters/*` | 角色卡文件 |
| GET | `/User%20Avatars/*` | 用户头像文件 |
| GET | `/assets/*` | 资源文件 |
| GET | `/user/images/*` | 用户图片 |
| GET | `/user/files/*` | 用户文件 |
| GET | `/scripts/extensions/third-party/*` | 第三方扩展 |

#### `src/endpoints/users-private.js` — 前缀 `/api/users`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/users/logout` | 登出 |
| GET | `/api/users/me` | 获取当前用户信息 |
| POST | `/api/users/change-avatar` | 更改头像 |
| POST | `/api/users/backup` | 备份用户数据 |
| POST | `/api/users/delete` | 删除账户 |

#### `src/endpoints/users-admin.js` — 前缀 `/api/users`（需 admin）

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/users/get` | 获取所有用户列表 |
| POST | `/api/users/create` | 创建用户 |
| POST | `/api/users/edit` | 编辑用户 |
| POST | `/api/users/delete` | 删除用户 |
| POST | `/api/users/disable` | 禁用用户 |
| POST | `/api/users/enable` | 启用用户 |

#### `src/endpoints/characters.js` — 前缀 `/api/characters`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/characters/all` | 获取所有角色 |
| POST | `/api/characters/get` | 获取单个角色 |
| POST | `/api/characters/create` | 创建角色 |
| POST | `/api/characters/edit` | 编辑角色 |
| POST | `/api/characters/delete` | 删除角色 |
| POST | `/api/characters/import` | 导入角色 |
| POST | `/api/characters/duplicate` | 复制角色 |
| POST | `/api/characters/export` | 导出角色 |
| POST | `/api/characters/rename` | 重命名角色 |
| POST | `/api/characters/edit-attribute` | 编辑角色属性 |
| POST | `/api/characters/merge-attributes` | 合并角色属性 |
| POST | `/api/characters/chats` | 获取角色的所有聊天 |
| POST | `/api/characters/convert-to-avatarbase64` | 转换头像为 base64 |

#### `src/endpoints/chats.js` — 前缀 `/api/chats`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/chats/save` | 保存聊天 |
| POST | `/api/chats/get` | 获取聊天 |
| POST | `/api/chats/rename` | 重命名聊天 |
| POST | `/api/chats/delete` | 删除聊天 |
| POST | `/api/chats/export` | 导出聊天 |
| POST | `/api/chats/import` | 导入聊天 |
| POST | `/api/chats/group/get` | 获取群组聊天 |
| POST | `/api/chats/group/save` | 保存群组聊天 |
| POST | `/api/chats/group/delete` | 删除群组聊天 |
| POST | `/api/chats/group/import` | 导入群组聊天 |

#### `src/endpoints/groups.js` — 前缀 `/api/groups`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/groups/all` | 获取所有群组 |
| POST | `/api/groups/create` | 创建群组 |
| POST | `/api/groups/edit` | 编辑群组 |
| POST | `/api/groups/delete` | 删除群组 |

#### `src/endpoints/worldinfo.js` — 前缀 `/api/worldinfo`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/worldinfo/get` | 获取世界信息 |
| POST | `/api/worldinfo/list` | 列出世界信息 |
| POST | `/api/worldinfo/create` | 创建世界信息 |
| POST | `/api/worldinfo/edit` | 编辑世界信息 |
| POST | `/api/worldinfo/delete` | 删除世界信息 |
| POST | `/api/worldinfo/import` | 导入世界信息 |
| POST | `/api/worldinfo/export` | 导出世界信息 |

#### `src/endpoints/settings.js` — 前缀 `/api/settings`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/settings/get` | 获取设置 |
| POST | `/api/settings/save` | 保存设置 |
| POST | `/api/settings/backup` | 备份设置 |
| POST | `/api/settings/restore` | 恢复设置 |
| POST | `/api/settings/patch` | 部分更新设置 |

#### `src/endpoints/openai.js` — 前缀 `/api/openai`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/openai/caption-image` | 图像描述（多提供商） |
| POST | `/api/openai/proxy` | OpenAI API 代理 |
| POST | `/api/openai/models` | 获取模型列表 |
| POST | `/api/openai/voice` | 语音合成 (TTS) |

#### `src/endpoints/google.js` — 前缀 `/api/google`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/google/caption-image` | 图像描述 |
| POST | `/api/google/proxy` | Google API 代理 |
| POST | `/api/google/models` | 获取模型列表 |
| POST | `/api/google/tts` | 文本转语音 |
| POST | `/api/google/stt` | 语音转文本 |

#### `src/endpoints/anthropic.js` — 前缀 `/api/anthropic`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/anthropic/caption-image` | 图像描述 (Claude) |
| POST | `/api/anthropic/proxy` | Anthropic API 代理 |

#### `src/endpoints/backends/chat-completions.js` — 前缀 `/api/backends/chat-completions`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/backends/chat-completions/generate` | 聊天补全生成（多后端） |

#### `src/endpoints/backends/text-completions.js` — 前缀 `/api/backends/text-completions`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/backends/text-completions/generate` | 文本补全生成 |

#### `src/endpoints/backends/kobold.js` — 前缀 `/api/backends/kobold`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/backends/kobold/generate` | Kobold 文本生成 |

#### `src/endpoints/stable-diffusion.js` — 前缀 `/api/sd`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/sd/ping` | 检测 SD 服务 |
| POST | `/api/sd/generate` | 图像生成 |
| POST | `/api/sd/models` | 获取模型列表 |
| POST | `/api/sd/upscalers` | 获取放大器列表 |
| POST | `/api/sd/samplers` | 获取采样器列表 |
| POST | `/api/sd/vae` | 获取 VAE 列表 |
| POST | `/api/sd/workflows` | ComfyUI 工作流管理 |

#### `src/endpoints/horde.js` — 前缀 `/api/horde`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/horde/generate` | AI Horde 文本生成 |
| POST | `/api/horde/generate-image` | AI Horde 图像生成 |
| POST | `/api/horde/status` | 获取状态 |
| POST | `/api/horde/models` | 获取模型列表 |
| POST | `/api/horde/workers` | 获取工作节点列表 |

#### `src/endpoints/extensions.js` — 前缀 `/api/extensions`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/extensions/list` | 列出已安装扩展 |
| POST | `/api/extensions/install` | 安装扩展 |
| POST | `/api/extensions/update` | 更新扩展 |
| POST | `/api/extensions/uninstall` | 卸载扩展 |
| POST | `/api/extensions/discover` | 发现新扩展 |

#### `src/endpoints/secrets.js` — 前缀 `/api/secrets`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/secrets/get` | 获取已配置的密钥名列表 |
| POST | `/api/secrets/write` | 写入密钥 |
| POST | `/api/secrets/delete` | 删除密钥 |

#### `src/endpoints/tokenizers.js` — 前缀 `/api/tokenizers`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/tokenizers/list` | 列出可用分词器 |
| POST | `/api/tokenizers/count` | 计算 token 数量 |
| POST | `/api/tokenizers/encode` | 编码文本 |
| POST | `/api/tokenizers/decode` | 解码 tokens |

#### `src/endpoints/presets.js` — 前缀 `/api/presets`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/presets/get` | 获取预设列表 |
| POST | `/api/presets/save` | 保存预设 |
| POST | `/api/presets/delete` | 删除预设 |
| POST | `/api/presets/load` | 加载预设 |

#### `src/endpoints/images.js` — 前缀 `/api/images`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/images/upload` | 上传图片 |
| POST | `/api/images/list/:folder` | 列出图片 |
| POST | `/api/images/delete` | 删除图片 |

#### `src/endpoints/backgrounds.js` — 前缀 `/api/backgrounds`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/backgrounds/all` | 获取所有背景图 |
| POST | `/api/backgrounds/upload` | 上传背景图 |
| POST | `/api/backgrounds/delete` | 删除背景图 |
| POST | `/api/backgrounds/rename` | 重命名背景图 |

#### `src/endpoints/sprites.js` — 前缀 `/api/sprites`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/sprites/get` | 获取角色精灵图 |
| POST | `/api/sprites/upload` | 上传精灵图 |
| POST | `/api/sprites/delete` | 删除精灵图 |

#### `src/endpoints/avatars.js` — 前缀 `/api/avatars`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/avatars/get` | 获取用户头像列表 |
| POST | `/api/avatars/delete` | 删除头像 |
| POST | `/api/avatars/upload` | 上传头像 |

#### `src/endpoints/themes.js` — 前缀 `/api/themes`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/themes/save` | 保存主题 |
| POST | `/api/themes/delete` | 删除主题 |

#### `src/endpoints/moving-ui.js` — 前缀 `/api/moving-ui`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/moving-ui/save` | 保存 UI 布局 |
| POST | `/api/moving-ui/get` | 获取 UI 布局 |

#### `src/endpoints/quick-replies.js` — 前缀 `/api/quick-replies`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/quick-replies/save` | 保存快捷回复 |
| POST | `/api/quick-replies/delete` | 删除快捷回复 |
| POST | `/api/quick-replies/get` | 获取快捷回复 |

#### `src/endpoints/assets.js` — 前缀 `/api/assets`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/api/assets/list` | 列出资源文件 |
| POST | `/api/assets/upload` | 上传资源 |
| POST | `/api/assets/download` | 下载远程资源 |
| POST | `/api/assets/delete` | 删除资源 |

#### `src/endpoints/files.js` — 前缀 `/api/files`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/files/sanitize-filename` | 清理文件名 |
| POST | `/api/files/upload` | 上传文件 |
| POST | `/api/files/list` | 列出文件 |
| POST | `/api/files/delete` | 删除文件 |
| POST | `/api/files/get` | 获取文件 |

#### `src/endpoints/content-manager.js` — 前缀 `/api/content`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/content/importURL` | 从 URL 导入内容 |
| POST | `/api/content/import` | 导入内容文件 |
| POST | `/api/content/export` | 导出内容 |
| POST | `/api/content/check` | 检查新内容 |
| GET | `/api/content/list` | 列出可用内容 |

#### `src/endpoints/stats.js` — 前缀 `/api/stats`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/stats/get` | 获取统计数据 |
| POST | `/api/stats/recreate` | 重新创建统计 |
| POST | `/api/stats/update` | 更新统计 |

#### `src/endpoints/vectors.js` — 前缀 `/api/vector`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/vector/list` | 列出向量源 |
| POST | `/api/vector/query` | 查询向量 |
| POST | `/api/vector/import` | 导入向量 |
| POST | `/api/vector/export` | 导出向量 |
| POST | `/api/vector/delete` | 删除向量 |
| POST | `/api/vector/purge` | 清除所有向量 |

#### `src/endpoints/translate.js` — 前缀 `/api/translate`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/translate/libre` | Libre 翻译 |
| POST | `/api/translate/deepl` | DeepL 翻译 |
| POST | `/api/translate/deeplx` | DeepLX 翻译 |
| POST | `/api/translate/onering` | OneRing 翻译 |
| POST | `/api/translate/lingva` | Lingva 翻译 |
| POST | `/api/translate/google` | Google 翻译 |
| POST | `/api/translate/bing` | Bing 翻译 |

#### `src/endpoints/search.js` — 前缀 `/api/search`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/search/serpapi` | SerpAPI 搜索 |
| POST | `/api/search/visit` | 访问网页 |
| POST | `/api/search/transcript` | YouTube 字幕提取 |
| POST | `/api/search/general` | 通用搜索 |

#### `src/endpoints/classify.js` — 前缀 `/api/extra/classify`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/extra/classify/labels` | 获取分类标签 |
| POST | `/api/extra/classify/` | 文本分类 |

#### `src/endpoints/caption.js` — 前缀 `/api/extra/caption`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/extra/caption/` | 图像描述 (本地模型) |

#### `src/endpoints/speech.js` — 前缀 `/api/speech`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/speech/recognize` | 语音识别 (本地 Whisper) |
| POST | `/api/speech/synthesize` | 语音合成 |
| POST | `/api/speech/list` | 列出语音合成引擎 |

#### `src/endpoints/openrouter.js` — 前缀 `/api/openrouter`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/openrouter/models/providers` | 获取模型提供商 |
| POST | `/api/openrouter/models` | 获取模型列表 |
| POST | `/api/openrouter/generate` | 通过 OpenRouter 生成 |

#### `src/endpoints/nanogpt.js` — 前缀 `/api/nanogpt`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/nanogpt/credits` | 获取账户余额 |
| POST | `/api/nanogpt/generate` | 通过 NanoGPT 生成 |

#### `src/endpoints/novelai.js` — 前缀 `/api/novelai`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/novelai/generate` | 文本生成 |
| POST | `/api/novelai/generate-image` | 图像生成 |
| POST | `/api/novelai/classify` | 文本分类 |

#### `src/endpoints/azure.js` — 前缀 `/api/azure`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/azure/list` | 列出 Azure TTS 语音 |
| POST | `/api/azure/generate` | Azure 语音合成 |

#### `src/endpoints/volcengine.js` — 前缀 `/api/volcengine`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/volcengine/generate-voice` | 火山引擎语音合成 |

#### `src/endpoints/minimax.js` — 前缀 `/api/minimax`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/minimax/generate-voice` | MiniMax 语音合成 |

#### `src/endpoints/data-maid.js` — 前缀 `/api/data-maid`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/data-maid/report` | 生成数据报告 |
| POST | `/api/data-maid/cleanup` | 清理孤立数据 |

#### `src/endpoints/backups.js` — 前缀 `/api/backups`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/backups/chat/get` | 获取聊天备份列表 |
| POST | `/api/backups/chat/delete` | 删除聊天备份 |
| POST | `/api/backups/chat/restore` | 恢复聊天备份 |

#### `src/endpoints/thumbnails.js` — 前缀 `/thumbnail`

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | `/thumbnail/:type/:file` | 获取缩略图 |

#### `src/endpoints/image-metadata.js` — 前缀 `/api/image-metadata`

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/image-metadata/get` | 获取图像元数据 |
| POST | `/api/image-metadata/rebuild` | 重建元数据索引 |

### 旧版端点重定向

以下旧端点通过 308 重定向到新端点（`server-startup.js` 中定义）：

| 旧端点 | 新端点 |
|--------|--------|
| `/createcharacter` | `/api/characters/create` |
| `/renamecharacter` | `/api/characters/rename` |
| `/editcharacter` | `/api/characters/edit` |
| `/editcharacterattribute` | `/api/characters/edit-attribute` |
| `/v2/editcharacterattribute` | `/api/characters/merge-attributes` |
| `/deletecharacter` | `/api/characters/delete` |
| `/getcharacters` | `/api/characters/all` |
| `/getonecharacter` | `/api/characters/get` |
| `/getallchatsofcharacter` | `/api/characters/chats` |
| `/importcharacter` | `/api/characters/import` |
| `/dupecharacter` | `/api/characters/duplicate` |
| `/exportcharacter` | `/api/characters/export` |
| `/savechat` | `/api/chats/save` |
| `/getchat` | `/api/chats/get` |
| `/renamechat` | `/api/chats/rename` |
| `/delchat` | `/api/chats/delete` |
| `/exportchat` | `/api/chats/export` |
| `/importgroupchat` | `/api/chats/group/import` |
| `/importchat` | `/api/chats/import` |
| `/getgroupchat` | `/api/chats/group/get` |
| `/deletegroupchat` | `/api/chats/group/delete` |
| `/savegroupchat` | `/api/chats/group/save` |
| `/getgroups` | `/api/groups/all` |
| `/creategroup` | `/api/groups/create` |
| `/editgroup` | `/api/groups/edit` |
| `/deletegroup` | `/api/groups/delete` |
| `/getworldinfo` | `/api/worldinfo/get` |
| `/deleteworldinfo` | `/api/worldinfo/delete` |
| `/importworldinfo` | `/api/worldinfo/import` |
| `/editworldinfo` | `/api/worldinfo/edit` |
| `/getstats` | `/api/stats/get` |
| `/recreatestats` | `/api/stats/recreate` |
| `/updatestats` | `/api/stats/update` |
| `/getbackgrounds` | `/api/backgrounds/all` |
| `/delbackground` | `/api/backgrounds/delete` |
| `/renamebackground` | `/api/backgrounds/rename` |
| `/downloadbackground` | `/api/backgrounds/upload` |
| `/savetheme` | `/api/themes/save` |
| `/getuseravatars` | `/api/avatars/get` |
| `/deleteuseravatar` | `/api/avatars/delete` |
| `/uploaduseravatar` | `/api/avatars/upload` |
| `/deletequickreply` | `/api/quick-replies/delete` |
| `/savequickreply` | `/api/quick-replies/save` |
| `/uploadimage` | `/api/images/upload` |
| `/listimgfiles/:folder` | `/api/images/list/:folder` |
| `/api/content/import` | `/api/content/importURL` |
| `/savemovingui` | `/api/moving-ui/save` |
| `/api/serpapi/search` | `/api/search/serpapi` |
| `/api/serpapi/visit` | `/api/search/visit` |
| `/api/serpapi/transcript` | `/api/search/transcript` |
