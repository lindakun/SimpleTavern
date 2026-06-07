# 迭代计划：角色隐私类型（privacyType）

> **迭代目标**：为角色系统新增"角色隐私类型"属性，实现公共/私有角色的差异化展示与复制功能。
> 
> **创建日期**：2026-06-07
> 
> **关联分支**：`feature/iteration-p0`

---

## 一、需求摘要

| # | 需求 | 说明 |
|---|------|------|
| 1 | 新增属性 `privacyType` | 码值：`"public"`（公共）、`"private"`（私有） |
| 2 | 发现页过滤 | `GET /api/discover` 仅返回 `privacyType === "public"` 的角色 |
| 3 | 创建/导入默认私有 | 新建角色或导入角色时，`privacyType` 默认 `"private"` |
| 4 | 创建/编辑页可选 | 在"创建角色"和"编辑角色"页面可选择"公开"或"私有" |
| 5 | 我的角色快捷切换 | "我的角色"列表页可直接切换角色的公开/私有状态 |
| 6 | 我的角色仅看自己的 | `GET /api/users/characters` 仅返回当前用户创建的角色 |
| 7 | 公共角色支持复制 | 在发现页/详情页可复制公共角色，复制后默认私有，创建人=操作者 |

---

## 二、现状分析

### 2.1 现有字段

| 字段 | 位置 | 值域 | 用途 |
|------|------|------|------|
| `status` | `UserCharacter`, `SeedCharacter`, `Character` | `"online"` / `"private"` / `"draft"` | 发布状态：draft=草稿不展示，online/private=已发布。**注意：`"private"` 在此上下文中不代表隐私，仅表示已发布但标记为私密状态** |

### 2.2 发现页当前逻辑

```
DiscoverScreen 过滤规则： if (c.status === 'draft') return false
```
→ 目前 `status: "private"` 的角色仍然出现在发现页中。

### 2.3 数据来源

| 来源 | 存储 | 读取路径 |
|------|------|----------|
| 种子角色 | `backend/src/data/seed-characters.json` (RAM) | `GET /api/discover` → `seedService.getSeedCharacters()` |
| 导入 PNG 角色 | `dataRoot/default-user/characters/*.png` | `GET /api/discover` → `getImportedCharacters()` |
| 用户创建角色 | `node-persist` key=`userchar:<handle>:<id>` | `GET /api/users/characters` → `userCharacterService.getUserCharacters()` |

### 2.4 现有与需求的差异

| 差异点 | 现状 | 需求 |
|--------|------|------|
| 隐私概念 | 无独立的隐私字段 | 需要 `privacyType: "public" | "private"` |
| 发现页可见性 | 仅过滤 draft | 需过滤 `privacyType !== "public"` 的角色 |
| 创建默认值 | `status: "online"` | `privacyType: "private"` |
| 复制功能 | 仅 PNG 角色卡复制(`/api/characters/duplicate`) | 需支持 node-persist 角色的复制 |
| 快捷切换 | 无 | 需在角色列表页支持一键切换 |

---

## 三、设计决策

### 3.1 新增字段而非复用

**决策**：新增独立字段 `privacyType`，不复用现有 `status`。

**原因**：
1. `status` 语义为"发布状态"（草稿/已发布），与隐私是两个独立维度
2. 两者正交组合：`draft + private`（未发布的私有角色）、`online + public`（已发布的公开角色）等
3. 避免破坏现有逻辑，尤其是发现页的 draft 过滤、角色卡片的 ONLINE/PRIVATE/DRAFT 徽章

### 3.2 种子角色 & 导入角色隐私策略

| 来源 | privacyType 默认值 | 说明 |
|------|-------------------|------|
| 种子角色 | `"public"` | 种子数据本身就是公开内容 |
| 导入 PNG (default-user) | `"public"` | 导入到 default-user 的角色即为公共角色 |
| 用户创建 | `"private"` | 用户创建默认私有 |
| 用户导入 PNG | `"private"` | 导入到用户目录默认私有 |

### 3.3 发现页合并用户公共角色

当前 `GET /api/discover` 仅返回种子角色 + default-user 导入角色。迭代后，还需返回**所有用户发布且 `privacyType === "public"` 的 node-persist 角色**。

---

## 四、改动清单

### 4.1 后端改动

#### 4.1.1 类型定义

**文件**：`backend/src/modules/characters/characters.user.service.ts`

```diff
 interface UserCharacter {
   id: string;
   // ... 现有字段 ...
   status: 'online' | 'private' | 'draft';
+  privacyType: 'public' | 'private';
   // ...
 }
```

#### 4.1.2 UserCharacterService 改动

**文件**：`backend/src/modules/characters/characters.user.service.ts`

| 函数 | 改动 |
|------|------|
| `publishCharacter()` | 新增 `privacyType: "private"` 默认值；接受前端传入的 `privacyType` 参数 |
| `updateUserCharacter()` | 在更新逻辑中新增 `privacyType` 字段处理 |
| **新增** `updateCharacterPrivacy()` | 快捷切换隐私类型：`(handle, characterId, privacyType)` |
| **新增** `getAllPublicCharacters()` | 遍历所有用户的 node-persist 数据，返回 `privacyType === "public"` 的角色 |
| **新增** `copyPublicCharacter()` | 复制公共角色到当前用户：读取源角色 → 生成新 id → `privacyType: "private"` → `creator: targetHandle` → 保存 |

#### 4.1.3 公开路由改动

**文件**：`backend/src/modules/characters/characters.public.routes.ts`

| 端点 | 改动 |
|------|------|
| `GET /api/users/characters` | 确认仅返回当前 handle 的角色（目前已是） |
| `POST /api/users/characters/edit` | body 新增 `privacyType` 字段透传 |
| **新增** `POST /api/users/characters/privacy` | 快捷切换隐私类型 `{ characterId, privacyType }` |
| **新增** `POST /api/characters/copy` | 复制公共角色 `{ characterId, sourceHandle }` |

#### 4.1.4 发现路由改动

**文件**：`backend/src/modules/characters/discover.controller.ts`

| 函数 | 改动 |
|------|------|
| `getDiscoverCharacters()` | 1. 种子角色 → 过滤 `status !== "draft"`（保留现有逻辑）; 2. 导入角色 → 默认 `privacyType: "public"`; 3. **新增**：合并所有用户的公共 node-persist 角色 |
| `getImportedCharacters()` | 返回数据中新增 `privacyType: "public"` |
| `getDiscoverCharacter()` | 新增查询 node-persist 公共角色（id 以 `custom_` 开头） |

#### 4.1.5 种子角色服务

**文件**：`backend/src/modules/characters/seed.service.ts`

```diff
 // 在返回种子角色列表时为每条记录补充 privacyType
+ privacyType: 'public',
```

#### 4.1.6 PNG 角色导入

**文件**：`backend/src/modules/characters/characters.public.import.routes.ts`

导入路由当前无需改动——导入的角色存为 PNG 文件，通过 `/api/users/png-characters` 返回。需确认该端点返回的数据包含 `privacyType: "private"`。

#### 4.1.7 用户 PNG 角色列表

**文件**：`backend/src/modules/characters/characters.public.routes.ts` — `GET /api/users/png-characters`

```diff
 // mapPngCharacters() 中新增字段
 status: 'online' as const,
+privacyType: 'private',
```

---

### 4.2 前端改动

#### 4.2.1 类型定义

**文件**：`frontend/src/types.ts`

```diff
 export interface Character {
   // ... 现有字段 ...
   status?: 'online' | 'offline' | 'draft' | 'private';
+  privacyType?: 'public' | 'private';
   // ...
 }
```

#### 4.2.2 API 层

**文件**：`frontend/src/api/characters.ts`

| 方法 | 改动 |
|------|------|
| **新增** `updateCharacterPrivacy()` | `POST /api/users/characters/privacy` |
| **新增** `copyCharacter()` | `POST /api/characters/copy` |

#### 4.2.3 Hooks 层

**文件**：`frontend/src/hooks/useCharacters.ts`

| Hook | 改动 |
|------|------|
| **新增** `useUpdateCharacterPrivacy()` | `useMutation` → invalidate `myCharacters` + `discover` |
| **新增** `useCopyCharacter()` | `useMutation` → invalidate `myCharacters` + `discover` |

#### 4.2.4 创建角色页（CreateCharacterScreen）

**文件**：`frontend/src/components/CreateCharacterScreen.tsx`

改动：
1. `CharacterForm` 接口新增 `privacyType: 'public' | 'private'`
2. 默认值设为 `'private'`
3. 新增 UI 区块：**"隐私设置"** Section，两个选项按钮（公开 / 私有）
4. `handlePublish()` 中透传 `privacyType` 到 `newChar` 对象
5. `formFromCharacter()` 回填 `privacyType`

```
┌─────────────────────────────────────┐
│ 隐私设置                            │
│                                     │
│  ┌──────────────┐ ┌──────────────┐  │
│  │  🔓 公开     │ │  🔒 私有     │  │
│  │  所有人可见   │ │  仅自己可见   │  │
│  └──────────────┘ └──────────────┘  │
└─────────────────────────────────────┘
```

#### 4.2.5 我的角色页（MyCharactersScreen）

**文件**：`frontend/src/components/MyCharactersScreen.tsx`

改动：
1. 在角色卡片操作栏中新增"隐私切换"按钮（锁/解锁图标）
2. 点击调用 `onUpdatePrivacy(id, newType)` 回调
3. 显示当前隐私状态标签（替代或增强现有的 PRIVATE 徽章）

```
当前卡片 actions:
  [编辑] [删除] [对话]

改为:
  [编辑] [删除] [🔒/🔓] [对话]
```

具体交互：
- `privacyType === "private"` → 显示 🔒 图标，hover 提示"设为公开"，点击切换为 `"public"`
- `privacyType === "public"` → 显示 🔓 图标，hover 提示"设为私有"，点击切换为 `"private"`

#### 4.2.6 角色详情页（CharacterDetailScreen）

**文件**：`frontend/src/components/CharacterDetailScreen.tsx`

改动：
- 对于 `privacyType === "public"` 的角色，在底部操作栏或页面某处显示"复制角色"按钮
- 点击调用 `onCopyCharacter(characterId, sourceHandle)`
- 复制成功后 toast 提示并跳转到"我的角色"页

#### 4.2.7 发现页（DiscoverScreen）

**文件**：`frontend/src/components/DiscoverScreen.tsx`

改动：
- 无需前端过滤（后端已过滤），但建议保留本地兜底：`if (c.status === 'draft' || c.privacyType === 'private') return false`

#### 4.2.8 App.tsx（数据流）

**文件**：`frontend/src/App.tsx` (或使用 hooks 的父组件)

改动：
1. 为 `MyCharactersScreen` 传入 `onUpdatePrivacy` 回调
2. 为 `CharacterDetailScreen` 传入 `onCopyCharacter` 回调
3. 为 `CreateCharacterScreen` 传入 `privacyType` 支持

---

## 五、API 设计详情

### 5.1 POST /api/users/characters/privacy

快捷切换隐私类型：

```
Request:
{
  "characterId": "custom_a1b2c3d4",
  "privacyType": "public" | "private"
}

Response 200:
{
  "id": "custom_a1b2c3d4",
  "privacyType": "public",
  ...
}

Response 404:
{ "error": "Character not found" }
```

### 5.2 POST /api/characters/copy

复制公共角色：

```
Request:
{
  "characterId": "custom_a1b2c3d4",
  "sourceHandle": "originalUser"
}

Response 200:
{
  "id": "custom_newid123",
  "name": "角色名称",
  "creator": "currentUser",
  "privacyType": "private",
  ...
}

Response 404:
{ "error": "Character not found or not public" }
```

逻辑：
1. 根据 `sourceHandle` + `characterId` 查找源角色
2. 验证源角色的 `privacyType === "public"`
3. 生成新 id（`custom_<uuid8>`）
4. 复制所有字段，覆写 `id`, `creator`(当前用户), `privacyType`("private"), `createdAt`(当前时间)
5. 保存到当前用户的 node-persist
6. 返回新角色对象

### 5.3 GET /api/discover（增强）

返回数据合并三类来源：

```
种子角色 (privacyType: "public") 
  + 导入PNG角色 (privacyType: "public")
  + 用户公共角色 (node-persist, privacyType: "public")
```

---

## 六、数据兼容性

### 6.1 存量数据

| 数据类型 | 处理方式 |
|----------|----------|
| 种子角色 (`seed-characters.json`) | 内存中动态添加 `privacyType: "public"`，不改源文件 |
| 导入 PNG 角色 (`default-user/characters/*.png`) | 内存中动态添加 `privacyType: "public"` |
| 存量 node-persist 角色 | `getUserCharacters()` 中检测缺失 `privacyType` 时默认补 `"private"` |
| PNG 角色卡 tEXt chunk | 不修改 PNG 文件内容 |

### 6.2 前端兼容

```typescript
// 读取时安全回退
const isPublic = character.privacyType === 'public';

// 存量数据无 privacyType 时视为私有
const isPublic = character.privacyType === 'public'; // undefined !== 'public' → false
```

---

## 七、实施步骤

| 步骤 | 内容 | 涉及文件 | 预估工作量 |
|------|------|----------|-----------|
| **S1** | 后端类型 + Service 改动 | `characters.user.service.ts` | 小 |
| **S2** | 后端路由新增 | `characters.public.routes.ts`（privacy + copy 端点） | 中 |
| **S3** | 发现页增强 | `discover.controller.ts`, `seed.service.ts` | 中 |
| **S4** | 前端类型 + API + Hooks | `types.ts`, `api/characters.ts`, `hooks/useCharacters.ts` | 小 |
| **S5** | 创建/编辑角色页 | `CreateCharacterScreen.tsx` | 中 |
| **S6** | 我的角色页快捷切换 | `MyCharactersScreen.tsx` | 小 |
| **S7** | 详情页复制按钮 | `CharacterDetailScreen.tsx` | 小 |
| **S8** | 集成测试 | 全链路验证 | 中 |

### 建议执行顺序

```
S1 → S2 → S3 → S4 → S5 → S6 → S7 → S8
(后端先行，前端跟进)
```

---

## 八、风险与注意事项

1. **隐私字段与 status 字段不混淆**：`status: "private"` 是旧的发布状态标记，`privacyType: "private"` 是新的隐私属性。两者独立。存量代码中 MyCharactersScreen 的 `isPrivate = c.status === 'private'` 保持不变。

2. **node-persist 跨用户扫描**：`getAllPublicCharacters()` 需要遍历所有用户的 `userchar:*` 键。node-persist 不提供前缀扫描之外的筛选，需先 `keys()` 再逐个 `getItem()`。角色数量大时需考虑性能（当前生产环境角色数量不大，可接受）。

3. **复制角色时的数据一致性**：复制后 `reviews` 和评分应清空（新角色不应继承原角色的评价）。

4. **发现页缓存失效**：`GET /api/discover` 有 5 分钟 CDN 缓存。用户修改隐私类型后，需确保前端 invalidate 该查询。React Query 的 `useMutation` 已配置 `invalidate discover`，无需额外处理。

5. **Service Worker 缓存**：`/api/discover` 使用 Stale-While-Revalidate 策略，先返回缓存再静默更新。这意味着隐私修改后，旧缓存可能短暂显示旧数据。SW 策略按现有设计运行，无需改动。

6. **安全性**：`POST /api/characters/copy` 端点需验证源角色确实是 `public` 的，防止越权复制私有角色。

---

## 九、验收标准

- [ ] 发现页只展示 `privacyType === "public"` 的角色
- [ ] 创建角色时默认 `privacyType === "private"`
- [ ] 创建/编辑角色页可以选择"公开"或"私有"
- [ ] "我的角色"列表中可快捷切换隐私类型
- [ ] "我的角色"列表只展示当前用户创建的角色
- [ ] 公开角色可以被其他用户复制，复制后为私有角色
- [ ] 复制后的角色创建人正确显示为操作者
- [ ] 存量角色数据兼容（无 `privacyType` 视为私有）
- [ ] 修改隐私类型后，发现页在缓存过期后反映最新状态
