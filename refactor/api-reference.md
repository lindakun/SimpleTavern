# SimpleTavern API 参考

> 用于前端开发对接新后端（`http://localhost:8001`）
>
> 新后端与原 SillyTavern 保持 API 契约完全兼容，前端只需切换 API base URL 即可使用。

---

## 目录

- [通用约定](#通用约定)
- [认证流程](#认证流程)
- [公开 API](#公开-api)
- [用户 API（需登录）](#用户-api需登录)
- [管理员 API](#管理员-api)
- [角色 API](#角色-api)
- [聊天 API](#聊天-api)
- [数据模型](#数据模型)
- [错误处理](#错误处理)

---

## 通用约定

### 基础 URL

```
http://localhost:8001
```

### 请求格式

- POST 请求的 body 使用 `Content-Type: application/json`（除非有文件上传）
- 文件上传使用 `multipart/form-data`
- ~~所有 POST 请求需携带 `X-CSRF-Token` 请求头~~（当前简化版已禁用 CSRF 校验，token 始终返回 `"enabled"`）

### 会话管理

使用 `cookie-session`，登录后服务端会自动设置会话 cookie：
- Cookie 名称: `session-<hex>`（格式同原项目）
- `SameSite: Lax`
- `HttpOnly: true`
- 有效期: 400 天（可配置）

### 统一响应格式

```typescript
// 成功（2xx）
直接返回数据对象或数组

// 业务错误（4xx）
{ "error": "ERROR_CODE", "message": "Human-readable message" }

// 服务器错误（5xx）
{ "error": "INTERNAL_ERROR", "message": "Internal server error" }
```

### 返回码速查

| 状态码 | 含义 |
|--------|------|
| 200 | OK — 请求成功 |
| 204 | No Content — 成功，无返回体 |
| 400 | Bad Request — 参数错误 |
| 403 | Forbidden — 无权限/未登录 |
| 404 | Not Found — 资源不存在 |
| 409 | Conflict — 资源冲突（如用户已存在） |
| 429 | Too Many Requests — 频率限制 |
| 500 | Internal Server Error — 服务器错误 |

---

## 认证流程

```
┌─────────┐     ┌──────────────┐     ┌──────────────┐
│ 前端页面 │ ──> │ POST /login  │ ──> │ 设置会话     │
│          │ <── │ {handle}     │ <── │ cookie       │
└─────────┘     └──────────────┘     └──────────────┘
     │                                      │
     │ 后续请求自动携带 cookie               │
     │                                      │
     v                                      v
┌───────────────────────────────────────────────┐
│  GET /api/users/me  →  返回当前用户信息        │
│  POST /api/chats/save → 正常执行业务操作       │
└───────────────────────────────────────────────┘
```

---

## 公开 API

无需认证即可访问。

### `GET /csrf-token`

获取 CSRF Token。

```
GET /csrf-token
```

**响应 200:**

```json
{
  "token": "enabled"
}
```

> 注意：当前简化版禁用 CSRF，token 固定返回 `"enabled"`。后续完善后返回实际 hex token。

---

### `GET /version`

获取服务器版本。

```
GET /version
```

**响应 200:**

```json
{
  "version": "0.1.0",
  "name": "simple-tavern"
}
```

---

### `POST /api/users/list`

获取所有已启用的用户列表。

**请求体:** 无

**响应 200:**

```json
[
  {
    "handle": "default-user",
    "name": "User",
    "created": 1779721037960,
    "avatar": "/img/default-user.png",
    "password": false
  }
]
```

**响应 204:** 当 `enableDiscreetLogin` 为 `true` 时返回（无响应体）。

**响应字段说明:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `handle` | string | 用户标识（唯一） |
| `name` | string | 显示名称 |
| `created` | number | 创建时间戳 |
| `avatar` | string | 头像 URL（data URL 或默认路径） |
| `password` | boolean | 是否设置了密码 |

---

### `POST /api/users/login`

用户登录。

```
POST /api/users/login
Content-Type: application/json

{ "handle": "default-user", "password": "..." }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 用户标识 |
| `password` | string | 否 | 密码（用户无密码时可省略） |

**响应 200:**

```json
{ "handle": "default-user" }
```

**响应 400:**

```json
{ "error": "BAD_REQUEST", "message": "Missing required fields" }
```

**响应 403:**

```json
{ "error": "FORBIDDEN", "message": "Incorrect credentials" }
```

**响应 429:**

```json
{ "error": "TOO_MANY_REQUESTS", "message": "Too many attempts. Try again later or recover your password." }
```

> 登录成功后，服务端设置会话 cookie，后续请求自动携带。

---

### `POST /api/users/recover-step1`

开始密码恢复流程。生成 6 位恢复码并打印到服务器控制台。

```
POST /api/users/recover-step1
Content-Type: application/json

{ "handle": "default-user" }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 要恢复密码的用户 |

**响应 204:** 无响应体。恢复码打印在服务端控制台。

**响应 400:** `{ "error": "BAD_REQUEST", "message": "Missing required fields" }`

**响应 404:** `{ "error": "NOT_FOUND", "message": "User not found" }`

**响应 403:** `{ "error": "FORBIDDEN", "message": "User is disabled" }`

---

### `POST /api/users/recover-step2`

完成密码恢复。验证 6 位恢复码，设置新密码。

```
POST /api/users/recover-step2
Content-Type: application/json

{ "handle": "default-user", "code": "123456", "newPassword": "new-secret" }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 用户标识 |
| `code` | string | 是 | 6 位恢复码 |
| `newPassword` | string | 否 | 新密码。省略或空字符串将清除密码 |

**响应 204:** 成功。

**响应 403:** `{ "error": "FORBIDDEN", "message": "Incorrect code" }`

---

## 用户 API（需登录）

以下所有端点需要在请求中携带登录后的会话 cookie。

### `POST /api/users/logout`

登出。清除服务端会话。

```
POST /api/users/logout
```

**响应 204:** 无响应体。

---

### `GET /api/users/me`

获取当前登录用户的详细信息。

```
GET /api/users/me
```

**响应 200:**

```json
{
  "handle": "default-user",
  "name": "User",
  "created": 1779721037960,
  "avatar": "/img/default-user.png",
  "admin": true,
  "password": false
}
```

**响应字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `handle` | string | 用户标识 |
| `name` | string | 显示名称 |
| `created` | number | 创建时间戳 |
| `avatar` | string | 头像 URL（data URL 或默认路径） |
| `admin` | boolean | 是否为管理员 |
| `password` | boolean | 是否设置了密码 |

**响应 403:** `{ "error": "UNAUTHORIZED" }`

---

### `POST /api/users/change-password`

修改密码。管理员可修改任意用户密码（无需旧密码）。

```
POST /api/users/change-password
Content-Type: application/json

{ "handle": "default-user", "oldPassword": "old", "newPassword": "new" }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 要修改密码的用户 |
| `oldPassword` | string | 否 | 旧密码（管理员修改他人密码时可不填） |
| `newPassword` | string | 否 | 新密码。省略或空字符串将清除密码 |

**注意:** `handle` 必须与当前登录用户相同，或者当前用户是管理员。

**响应 204:** 成功。

**响应 403:** `{ "error": "Unauthorized" }` 或 `{ "error": "Incorrect password" }`

---

### `POST /api/users/change-name`

修改用户的显示名称。

```
POST /api/users/change-name
Content-Type: application/json

{ "handle": "default-user", "name": "NewName" }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 用户标识 |
| `name` | string | 是 | 新显示名称 |

**响应 204:** 成功。

---

### `POST /api/users/change-avatar`

修改用户头像（存储为 data URL）。

```
POST /api/users/change-avatar
Content-Type: application/json

{ "handle": "default-user", "avatar": "data:image/png;base64,..." }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 用户标识 |
| `avatar` | string | 是 | data URL（必须以 `data:image/` 开头）或空字符串（清除头像） |

**响应 204:** 成功。

**响应 400:** `{ "error": "Invalid data URL" }`

---

### `POST /api/users/change-password`

已在 [用户 API](#用户-api需登录) 中描述。

### `POST /api/users/reset-settings`

重置用户设置（删除 `settings.json` 文件）。

```
POST /api/users/reset-settings
Content-Type: application/json

{ "password": "..." }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `password` | string | 是* | 密码（用户有密码时必填） |

> *当前简化版可能未实现此端点，请参见 auth.controller.ts。

---

## 管理员 API

需要登录用户具有 `admin: true` 权限。

### `POST /api/users/get`

获取所有用户列表（含已禁用用户）。

```
POST /api/users/get
```

**响应 200:**

```json
[
  {
    "handle": "default-user",
    "name": "User",
    "created": 1779721037960,
    "avatar": "/img/default-user.png",
    "admin": true,
    "enabled": true,
    "password": false
  }
]
```

---

### `POST /api/users/create`

创建新用户。handle 会自动进行 slug 化处理（去重音、转小写、替换特殊字符）。

```
POST /api/users/create
Content-Type: application/json

{ "handle": "newuser", "name": "新用户", "password": "secret", "admin": false }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 用户标识（自动 slug 化） |
| `name` | string | 否 | 显示名称（默认与 handle 相同） |
| `password` | string | 否 | 密码（省略则无密码） |
| `admin` | boolean | 否 | 管理员权限（默认 false） |

**响应 200:**

```json
{ "handle": "slugified-handle" }
```

**响应 400:** `{ "error": "Invalid handle" }`

**响应 409:** `{ "error": "User already exists" }`

---

### `POST /api/users/delete`

删除用户。可选是否清除数据目录。

```
POST /api/users/delete
Content-Type: application/json

{ "handle": "someuser", "purge": true }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 要删除的用户 |
| `purge` | boolean | 否 | 是否同时删除用户数据目录 |

**限制:** 不能删除自己。不能删除 `default-user`。

**响应 204:** 成功。

---

### `POST /api/users/disable` / `enable` / `promote` / `demote`

启用/禁用用户、提升/撤销管理员权限。

```
POST /api/users/disable
Content-Type: application/json

{ "handle": "someuser" }
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `handle` | string | 是 | 目标用户 |

**限制:** 不能禁用/降级自己。

**响应 204:** 成功。

---

### `POST /api/users/slugify`

预览 handle 的 slug 化结果。

```
POST /api/users/slugify
Content-Type: application/json

{ "text": "测试 Handle" }
```

**响应 200:** `"ce-shi-handle"`（纯文本，非 JSON）

---

## 角色 API

所有角色 API 需要登录。角色数据存储为 PNG 文件，角色卡 JSON 嵌入在 PNG 的 tEXt 块中。

### `POST /api/characters/all`

获取所有角色列表。

```
POST /api/characters/all
Content-Type: application/json

{}
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `shallow` | boolean | 否 | 为 `true` 时只返回摘要信息（轻量列表） |

**响应 200（完整）:**

```json
[
  {
    "spec": "chara_card_v2",
    "spec_version": "2.0",
    "name": "测试角色",
    "description": "角色描述",
    "personality": "性格",
    "scenario": "场景",
    "first_mes": "你好！",
    "mes_example": "对话示例",
    "avatar": "测试角色.png",
    "chat": "测试角色 - 2026-01-01 12:00",
    "create_date": "2026-01-01T12:00:00.000Z",
    "date_added": 1779721037960,
    "date_last_chat": 0,
    "chat_size": 0,
    "data_size": 1234,
    "tags": [],
    "data": {
      "name": "测试角色",
      "description": "角色描述",
      "personality": "性格",
      "scenario": "场景",
      "first_mes": "你好！",
      "mes_example": "对话示例",
      "creator_notes": "",
      "system_prompt": "",
      "post_history_instructions": "",
      "tags": [],
      "creator": "",
      "character_version": "",
      "alternate_greetings": [],
      "extensions": {
        "talkativeness": 0.5,
        "fav": false,
        "world": "",
        "depth_prompt": {
          "prompt": "",
          "depth": 4,
          "role": "system"
        }
      }
    }
  }
]
```

**响应 200（浅层 `shallow: true`）:**

```json
[
  {
    "shallow": true,
    "name": "测试角色",
    "avatar": "测试角色.png",
    "chat": "测试角色 - 2026-01-01 12:00",
    "fav": false,
    "date_added": 1779721037960,
    "create_date": "2026-01-01T12:00:00.000Z",
    "date_last_chat": 0,
    "chat_size": 0,
    "data_size": 1234,
    "tags": [],
    "data": {
      "name": "测试角色",
      "character_version": "",
      "creator": "",
      "creator_notes": "",
      "tags": [],
      "extensions": {
        "fav": false,
        "world": ""
      }
    }
  }
]
```

---

### `POST /api/characters/get`

获取单个角色的完整数据。

```
POST /api/characters/get
Content-Type: application/json

{ "avatar_url": "测试角色.png" }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `avatar_url` | string | 是 | 角色文件名（含 `.png` 后缀） |

**响应 200:** 同 `/all` 的完整格式。

**响应 404:** `{ "error": "Character not found" }`

---

### `POST /api/characters/create`

创建新角色。角色数据会写入到 PNG 文件中。

```
POST /api/characters/create
Content-Type: application/json

{
  "name": "新角色",
  "description": "描述",
  "personality": "友好",
  "scenario": "场景",
  "first_mes": "你好！",
  "mes_example": "示例对话",
  "creator_notes": "作者笔记",
  "system_prompt": "系统提示词",
  "post_history_instructions": "历史指令",
  "tags": ["tag1", "tag2"],
  "creator": "作者",
  "character_version": "1.0",
  "talkativeness": 0.5,
  "world": "",
  "fav": false
}
```

> **前端注意:** body 可直接使用 script.js 中 `chara` 对象的字段名（`ch_name`、`description` 等），后端自动映射到 V2 格式。

**响应 200:**

```json
{ "path": "新角色.png" }
```

`path` 为生成的角色 PNG 文件名（自动去重，如 `新角色_1.png`）。

---

### `POST /api/characters/edit`

编辑角色的完整数据。

```
POST /api/characters/edit
Content-Type: application/json

{ "avatar_url": "新角色.png", "name": "已编辑的角色", "description": "..." }
```

**请求参数:** 同 `create`，额外需要 `avatar_url` 指定要编辑的角色文件。

**响应 200:**

```json
{ "ok": true }
```

---

### `POST /api/characters/delete`

删除角色 PNG 文件。

```
POST /api/characters/delete
Content-Type: application/json

{ "avatar_url": "要删除的角色.png" }
```

**响应 200:**

```json
{ "ok": true }
```

---

### `POST /api/characters/rename`

重命名角色。会同时重命名对应的聊天目录。

```
POST /api/characters/rename
Content-Type: application/json

{ "avatar_url": "旧文件.png", "name": "新名称" }
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `avatar_url` | string | 是 | 当前角色文件名 |
| `name` | string | 是 | 角色新名称 |

**响应 200:**

```json
{ "path": "新名称.png" }
```

---

### `POST /api/characters/duplicate`

复制角色。

```
POST /api/characters/duplicate
Content-Type: application/json

{ "avatar_url": "测试角色.png" }
```

**响应 200:**

```json
{ "path": "测试角色 (copy).png" }
```

---

### `POST /api/characters/export`

导出角色的 PNG 文件（直接下载）。

```
POST /api/characters/export
Content-Type: application/json

{ "avatar_url": "测试角色.png" }
```

**响应 200:** PNG 文件流（`Content-Type: application/octet-stream`）。

---

### `POST /api/characters/import`

从文件导入角色。支持 PNG 角色卡和 JSON 文件。

```
POST /api/characters/import
Content-Type: multipart/form-data

file: <文件> (PNG 或 JSON)
```

**请求参数:** 使用 `multipart/form-data` 上传文件，字段名为 `file`。

**响应 200:**

```json
{ "path": "导入的角色.png" }
```

---

### `POST /api/characters/chats`

获取角色的所有聊天文件列表。

```
POST /api/characters/chats
Content-Type: application/json

{ "avatar_url": "测试角色.png" }
```

**响应 200:**

```json
[
  {
    "file_id": "test-chat-001",
    "file_name": "test-chat-001.jsonl",
    "file_size": 299,
    "last_mes": 1779721037960
  }
]
```

---

## 聊天 API

聊天数据以 JSONL 格式存储（每行一个 JSON 对象）。

### 数据格式

```jsonl
// 第 1 行：聊天元数据头
{"chat_metadata":{},"user_name":"User","character_name":"测试角色"}

// 第 2+ 行：消息
{"name":"User","is_user":true,"send_date":"2026-01-01T00:00:00.000Z","mes":"你好！","extra":{}}
{"name":"测试角色","is_user":false,"send_date":"2026-01-01T00:00:00.000Z","mes":"你好！我是测试角色！","extra":{}}
```

**消息字段:**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 发送者名称 |
| `is_user` | boolean | 是否为用户（false = AI 角色） |
| `is_name` | boolean | 可选。是否显示名称标签 |
| `send_date` | string | ISO 8601 时间戳 |
| `mes` | string | 消息内容 |
| `extra` | object | 扩展数据 |
| `swipes` | string[] | 可选。备选回复列表 |
| `swipe_id` | number | 可选。当前选中的备选索引 |

---

### `POST /api/chats/save`

保存聊天数据。

```
POST /api/chats/save
Content-Type: application/json

{
  "avatar_url": "测试角色.png",
  "file_name": "my-chat",
  "chat": [
    {"chat_metadata": {}, "user_name": "User", "character_name": "测试角色"},
    {"name": "User", "is_user": true, "send_date": "...", "mes": "你好！", "extra": {}},
    {"name": "测试角色", "is_user": false, "send_date": "...", "mes": "你好！", "extra": {}}
  ]
}
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `avatar_url` | string | 是 | 角色文件名 |
| `file_name` | string | 是 | 聊天文件名（不含 `.jsonl`） |
| `chat` | array | 是 | 聊天数据数组（第 1 行为元数据头） |
| `force` | boolean | 否 | 跳过完整性检查 |

**响应 200:**

```json
{ "ok": true }
```

---

### `POST /api/chats/get`

获取聊天数据。

```
POST /api/chats/get
Content-Type: application/json

{ "avatar_url": "测试角色.png", "file_name": "my-chat" }
```

**响应 200:**

```json
[
  {"chat_metadata": {}, "user_name": "User", "character_name": "测试角色"},
  {"name": "User", "is_user": true, "send_date": "...", "mes": "你好！", "extra": {}},
  ...
]
```

**响应 200（聊天不存在或无文件名）:** `{}`

---

### `POST /api/chats/rename`

重命名聊天文件。

```
POST /api/chats/rename
Content-Type: application/json

{ "avatar_url": "测试角色.png", "original_file": "old-name", "renamed_file": "new-name" }
```

**响应 200:**

```json
{ "ok": true }
```

---

### `POST /api/chats/delete`

删除聊天文件。

```
POST /api/chats/delete
Content-Type: application/json

{ "avatar_url": "测试角色.png", "file_name": "my-chat" }
```

**响应 200:**

```json
{ "ok": true }
```

---

### `POST /api/chats/export`

导出聊天数据。

```
POST /api/chats/export
Content-Type: application/json

{ "avatar_url": "测试角色.png", "file_name": "my-chat" }
```

**响应 200:** JSON 数组（同 `/get`）。

---

### `POST /api/chats/import`

从文件导入聊天数据。

```
POST /api/chats/import
Content-Type: multipart/form-data

file: <JSON 文件>
avatar_url: 测试角色.png
file_name: my-chat-imported
```

**请求参数:** `multipart/form-data`，文件字段 `file` + 表单字段 `avatar_url`、`file_name`。

**响应 200:**

```json
{ "ok": true }
```

---

### 群组聊天 API

群组聊天存储在 `chats/` 目录下的独立文件中（不按角色划分）。

#### `POST /api/chats/group/get`

获取群组聊天数据。

```
POST /api/chats/group/get
Content-Type: application/json

{ "file": "group-chat-file.jsonl" }
```

#### `POST /api/chats/group/save`

保存群组聊天数据。

```
POST /api/chats/group/save
Content-Type: application/json

{ "file": "group-chat-file.jsonl", "data": [...] }
```

#### `POST /api/chats/group/delete`

删除群组聊天文件。

```
POST /api/chats/group/delete
Content-Type: application/json

{ "file": "group-chat-file.jsonl" }
```

#### `POST /api/chats/group/import`

导入群组聊天文件。

```
POST /api/chats/group/import
Content-Type: multipart/form-data

file: <JSONL 文件>
file: group-chat-file.jsonl
```

---

## 数据模型

### User

```typescript
interface User {
  handle: string;      // 唯一标识（slug）
  name: string;        // 显示名称
  created: number;     // 创建时间戳
  password: string;    // scrypt 哈希（空字符串 = 无密码）
  salt: string;        // 密码盐值
  enabled: boolean;    // 账号是否启用
  admin: boolean;      // 管理员权限
}
```

### Character（V2 角色卡）

角色卡遵循 [character_card_v2](https://github.com/malfoyslastname/character-card-spec) 规范，数据嵌入在 PNG 文件的 `tEXt` 块中。

```typescript
interface CharacterV2 {
  spec: 'chara_card_v2';       // 固定值
  spec_version: '2.0';         // 固定值
  name: string;                // 角色名
  description: string;         // 角色描述
  personality: string;         // 性格
  scenario: string;            // 场景
  first_mes: string;           // 开场白
  mes_example: string;         // 对话示例
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    tags: string[];
    creator: string;
    character_version: string;
    alternate_greetings: string[];
    extensions: {
      talkativeness: number;   // 0-1
      fav: boolean;            // 是否收藏
      world: string;           // 关联世界信息
      depth_prompt: {
        prompt: string;
        depth: number;
        role: 'system' | 'user';
      };
    };
  };
}
```

### ChatMessage

```typescript
interface ChatMessage {
  name: string;                // 发送者名称
  is_user: boolean;            // 用户消息还是 AI 回复
  is_name?: boolean;           // 是否显示名称
  send_date: string;           // ISO 8601
  mes: string;                 // 消息内容
  extra: Record<string, any>;  // 扩展字段
  swipes?: string[];           // 备选回复
  swipe_id?: number;           // 当前备选索引
}
```

---

## 错误处理

### 错误码速查

| HTTP | 错误码 | 含义 |
|------|--------|------|
| 400 | `BAD_REQUEST` | 请求参数缺失或格式错误 |
| 403 | `UNAUTHORIZED` | 未登录 |
| 403 | `FORBIDDEN` | 无权限 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `CONFLICT` | 资源冲突 |
| 429 | `TOO_MANY_REQUESTS` | 请求频率限制 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

### 错误响应格式

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

### 前端错误处理示例

```javascript
async function apiPost(path, data) {
  const response = await fetch(`http://localhost:8001${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(response.status, body.error, body.message);
  }

  // 204 No Content
  if (response.status === 204) return null;

  return await response.json();
}
```

---

---

## AI 聊天 API

### `POST /api/chat`

角色扮演聊天接口。接收用户消息 + 角色信息，返回 AI 回复。

```
POST /api/chat
Content-Type: application/json

{
  "message": "你好！",
  "history": [],
  "characterName": "Yuki Murasaki",
  "characterDescription": "傲娇的黑客少女",
  "worldBook": "赛博朋克世界"
}
```

**请求参数:**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 用户消息内容 |
| `history` | array | 否 | 历史消息 `[{role, text}]` |
| `characterName` | string | 是 | AI 角色名称 |
| `characterDescription` | string | 是 | 角色设定描述 |
| `worldBook` | string | 否 | 世界书/世界观设定 |

**响应 200:**

```json
{
  "text": "*靠在霓虹灯闪烁的天台上*\n哼，既然你问了...",
  "provider": "llm_0",
  "model": "LongCat-2.0-Preview"
}
```

---

### `GET /api/chat/providers`

获取可用的 LLM 列表。

```
GET /api/chat/providers
```

**响应 200:**

```json
{
  "providers": [
    { "id": "llm_0", "name": "LongCat", "model": "LongCat-2.0-Preview" }
  ],
  "active": "llm_0"
}
```

---

## 收藏 API

### `GET /api/users/favorites`

获取当前用户的收藏角色 ID 列表。

```
GET /api/users/favorites
```

**响应 200:**

```json
{ "favorites": ["yuki", "yuzu_chan"] }
```

### `POST /api/users/favorites`

添加收藏。

```
POST /api/users/favorites
Content-Type: application/json

{ "characterId": "yuki" }
```

**响应 200:**

```json
{ "favorites": ["yuki", "yuzu_chan"] }
```

### `DELETE /api/users/favorites/:characterId`

取消收藏。

```
DELETE /api/users/favorites/yuki
```

**响应 200:**

```json
{ "favorites": ["yuzu_chan"] }
```

---

## 角色发现 API

### `GET /api/discover`

获取所有可发现角色（种子角色 + 用户导入角色）。

```
GET /api/discover
```

**响应 200:** 角色对象数组（同前端 `Character` 类型）。

### `GET /api/discover/:id`

获取单个角色详情。

```
GET /api/discover/yuki
```

### `POST /api/discover/:id/reviews`

添加角色评价。

```
POST /api/discover/yuki/reviews
Content-Type: application/json

{ "username": "Tester", "rating": 5, "comment": "很不错的角色！" }
```

**响应 200:** 更新后的角色对象（含重新计算的评分）。

---

## 角色发布与用户角色 API

### `POST /api/characters/publish`

从 CreateCharacterScreen 发布自定义角色。

```
POST /api/characters/publish
Content-Type: application/json

{
  "name": "我的角色",
  "tagline": "角色简介",
  "description": "详细描述",
  "worldBook": "世界书内容",
  "tags": ["标签1", "标签2"],
  "voiceType": "sweet"
}
```

**响应 200:**

```json
{
  "id": "custom_a1b2c3d4",
  "name": "我的角色",
  "creator": "default-user",
  "status": "online"
}
```

### `GET /api/users/characters`

获取当前用户创建的角色列表。

```
GET /api/users/characters
```

---

## 聊天线程 API

### `GET /api/chat/threads`

获取用户的所有聊天线程列表（按最后活跃时间降序）。

```
GET /api/chat/threads
```

**响应 200:**

```json
[
  {
    "characterId": "yuki",
    "characterName": "Yuki Murasaki",
    "lastMessageText": "哼，你总算想起找我了。",
    "lastActive": "2026-01-01T00:00:00.000Z",
    "messageCount": 3
  }
]
```

### `GET /api/chat/threads/:characterId`

获取特定角色的完整聊天历史。

```
GET /api/chat/threads/yuki
```

---

## 用户设置 API

### `GET /api/users/settings`

获取用户设置。

```
GET /api/users/settings
```

**响应 200:**

```json
{
  "settings": {
    "cloudBackup": true,
    "autoPlayAudio": false,
    "renderQuality": "high"
  }
}
```

### `POST /api/users/settings`

保存用户设置。

```
POST /api/users/settings
Content-Type: application/json

{
  "settings": {
    "cloudBackup": true,
    "autoPlayAudio": false,
    "renderQuality": "high"
  }
}
```

**响应 200:** `{ "ok": true }`

---

## 完整端点速查表

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/csrf-token` | - | 获取 CSRF token |
| GET | `/version` | - | 获取版本信息 |
| POST | `/api/users/list` | - | 列出用户 |
| POST | `/api/users/login` | - | 登录 |
| POST | `/api/users/recover-step1` | - | 密码恢复步骤 1 |
| POST | `/api/users/recover-step2` | - | 密码恢复步骤 2 |
| POST | `/api/users/logout` | 登录 | 登出 |
| GET | `/api/users/me` | 登录 | 获取当前用户 |
| POST | `/api/users/change-password` | 登录 | 修改密码 |
| POST | `/api/users/change-name` | 登录 | 修改显示名称 |
| POST | `/api/users/change-avatar` | 登录 | 修改头像 |
| POST | `/api/users/get` | 管理员 | 获取所有用户 |
| POST | `/api/users/create` | 管理员 | 创建用户 |
| POST | `/api/users/delete` | 管理员 | 删除用户 |
| POST | `/api/users/disable` | 管理员 | 禁用用户 |
| POST | `/api/users/enable` | 管理员 | 启用用户 |
| POST | `/api/users/promote` | 管理员 | 提升管理员 |
| POST | `/api/users/demote` | 管理员 | 撤销管理员 |
| POST | `/api/users/slugify` | 管理员 | 预览 slug |
| POST | `/api/characters/all` | 登录 | 角色列表 |
| POST | `/api/characters/get` | 登录 | 获取角色 |
| POST | `/api/characters/create` | 登录 | 创建角色 |
| POST | `/api/characters/edit` | 登录 | 编辑角色 |
| POST | `/api/characters/delete` | 登录 | 删除角色 |
| POST | `/api/characters/rename` | 登录 | 重命名角色 |
| POST | `/api/characters/duplicate` | 登录 | 复制角色 |
| POST | `/api/characters/export` | 登录 | 导出角色 |
| POST | `/api/characters/chats` | 登录 | 角色聊天列表 |
| POST | `/api/chats/save` | 登录 | 保存聊天 |
| POST | `/api/chats/get` | 登录 | 获取聊天 |
| POST | `/api/chats/rename` | 登录 | 重命名聊天 |
| POST | `/api/chats/delete` | 登录 | 删除聊天 |
| POST | `/api/chats/export` | 登录 | 导出聊天 |
| POST | `/api/chats/import` | 登录 | 导入聊天 |
| POST | `/api/chats/group/get` | 登录 | 获取群组聊天 |
| POST | `/api/chats/group/save` | 登录 | 保存群组聊天 |
| POST | `/api/chats/group/delete` | 登录 | 删除群组聊天 |
| POST | `/api/chats/group/import` | 登录 | 导入群组聊天 |
| POST | `/api/chat` | - | AI 角色扮演聊天 |
| GET | `/api/chat/providers` | - | 获取可用 LLM 列表 |
| GET | `/api/discover` | - | 发现角色列表（种子+导入） |
| GET | `/api/discover/:id` | - | 获取角色详情 |
| POST | `/api/discover/:id/reviews` | - | 添加角色评价 |
| GET | `/api/users/favorites` | - | 获取收藏列表 |
| POST | `/api/users/favorites` | - | 添加收藏 |
| DELETE | `/api/users/favorites/:id` | - | 取消收藏 |
| POST | `/api/characters/publish` | - | 发布自定义角色 |
| GET | `/api/users/characters` | - | 获取用户创建的角色 |
| POST | `/api/characters/import` | - | 导入角色卡(PNG/JSON) |
| GET | `/api/chat/threads` | - | 聊天线程列表 |
| GET | `/api/chat/threads/:id` | - | 聊天历史 |
| GET | `/api/users/settings` | - | 获取用户设置 |
| POST | `/api/users/settings` | - | 保存用户设置 |
