# SimpleTavern 迭代需求规划 v2

> **版本**：v2.0  
> **创建日期**：2026-06-10  
> **审查范围**：全量代码审查（frontend + backend + 已有文档）  
> **文档目的**：基于代码实际状态发掘高价值优化需求，覆盖已有 iteration-spec.md 未收录的 Bug、残缺功能与体验短板  

---

## 审查摘要

| 类别 | 数量 | 说明 |
|------|------|------|
| P0 严重 Bug（变量插值丢失） | 8 处 | 影响核心功能正确性，用户可直接感知 |
| P1 功能残缺（UI 占位未实现） | 5 处 | 页面可见但逻辑为空，用户点击无响应 |
| P2 功能缺失（规划中未落地） | 4 项 | iteration-spec 有规划但代码尚未实现 |
| P3 体验/性能优化 | 6 项 | 功能可用但体验存在明显短板 |
| 已完成确认 | 3 项 | 与 iteration-spec 核对，已落地 |

---

## 一、P0 — 严重 Bug（立即修复）

> 以下问题为**模板字符串变量插值丢失**，均因代码在编译/处理过程中变量名被剥除，导致文本中应动态展示的内容变成空白。直接影响用户感知，须第一优先级修复。

### B-01 欢迎消息用户名丢失

**文件**：`frontend/src/App.tsx` ≈ L182  
**现象**：登录成功后 Toast 提示显示 `欢迎回来，！` —— 感叹号前用户名为空。  
**根因**：模板字符串中变量插值丢失，应为 `` `欢迎回来，${handle}！` ``  
**修复方案**：
```tsx
// 现状（错误）
toast.success(`欢迎回来，！`);

// 修复
toast.success(`欢迎回来，${handle}！`);
```

---

### B-02 复制角色 Toast 角色名丢失

**文件**：`frontend/src/App.tsx` ≈ L289  
**现象**：复制角色时弹出 `复制角色「」成功` —— 书名号内角色名为空。  
**修复方案**：
```tsx
// 修复
toast.success(`复制角色「${character.name}」成功`);
```

---

### B-03 & B-04 消息发送失败错误信息丢失

**文件**：`frontend/src/App.tsx` ≈ L394 / L400  
**现象**：发送失败时显示 `消息发送失败: `（错误描述为空）和 `（发送失败：）`（错误内容为空），用户无法判断失败原因。  
**修复方案**：
```tsx
// 修复 L394
const errorMsg = `消息发送失败: ${error.message}`;

// 修复 L400（消息中的失败标注）
text: `（发送失败：${error.message}）`
```

---

### B-05 输入框自动高度失效

**文件**：`frontend/src/components/ChatScreen.tsx` ≈ L65  
**现象**：多行输入时输入框高度不随内容增长自动扩展，始终保持单行高度。  
**根因**：自动高度计算代码中 `scrollHeight` 变量名丢失，赋值变成 `` `el.style.height = 'px'` ``（字面量字符串，非数值）。  
**修复方案**：
```tsx
// 现状（错误）
el.style.height = 'px';

// 修复
el.style.height = 'auto';
el.style.height = `${el.scrollHeight}px`;
```

---

### B-06 消息搜索定位失效

**文件**：`frontend/src/components/ChatScreen.tsx` ≈ L89  
**现象**：搜索关键词后点击"下一条"无法滚动定位到对应消息，页面无任何滚动响应。  
**根因**：`getElementById('msg-')` 缺少 `idx` 变量，选择器为空字符串，永远找不到元素。  
**修复方案**：
```tsx
// 现状（错误）
const el = document.getElementById('msg-');

// 修复
const el = document.getElementById(`msg-${matchIds[currentMatchIndex]}`);
```

---

### B-07 高亮搜索词正则转义异常

**文件**：`frontend/src/components/ChatScreen.tsx` ≈ L127  
**现象**：搜索包含正则特殊字符（如 `+`、`.`、`(`）的词时，`highlightText` 函数抛出 `SyntaxError: Invalid regular expression`，导致整个聊天页面白屏。  
**根因**：转义函数被调用两次（双重转义），或转义字符自身变量名丢失，导致传入 `RegExp` 构造函数的是未转义原始字符串。  
**修复方案**：
```tsx
// 修复：确保只转义一次
const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const regex = new RegExp(`(${escaped})`, 'gi');
```

---

### B-08 语音朗读按钮角色名丢失

**文件**：`frontend/src/components/ChatScreen.tsx` ≈ L542  
**现象**：点击语音朗读按钮，弹出 alert 显示 `（🔊 正在为您播放  特属声音音频序列……）`——角色名缺失，变成两个空格。  
**修复方案**：
```tsx
// 修复（短期，保持 alert 占位逻辑不变，仅补全变量）
alert(`（🔊 正在为您播放 ${character.name} 特属声音音频序列……）`);
```
> 注：长期应替换为真实 TTS 功能，见 F-04。

---

## 二、P1 — 功能残缺（UI 已有但逻辑为空）

### F-01 我的角色搜索框不可用

**文件**：`frontend/src/components/MyCharactersScreen.tsx`  
**现象**：我的角色页顶部有搜索框，但 `disabled` 属性已硬编码，用户无法输入，点击无任何响应。  
**需求**：
1. 移除 `disabled` 属性，绑定 `searchQuery` 状态
2. 实现客户端实时过滤：按角色 `name` + `description` 模糊搜索
3. 无结果时显示空态提示「没有找到匹配的角色」
4. 搜索框右侧展示清空按钮（×），有内容时出现

---

### F-02 用户头像字母硬编码为「PT」

**文件**：`frontend/src/components/ChatScreen.tsx` ≈ L425  
**现象**：聊天页用户消息气泡左侧头像固定显示字母 `PT`，与实际登录用户无关。  
**需求**：
1. 从全局用户状态（`currentUser.handle`）读取当前用户 handle
2. 取 handle 前 2 个字符大写展示
3. 头像颜色可根据 handle hash 值动态生成（避免所有用户都是同一粉色）

```tsx
// 修复
const initials = (currentUser?.handle ?? 'ME').slice(0, 2).toUpperCase();
```

---

### F-03 发现页下拉刷新不触发数据重新拉取

**文件**：`frontend/src/components/DiscoverScreen.tsx`  
**现象**：下拉刷新手势触发后仅执行了布局 `measure()` 操作，未触发任何数据请求，数据不更新，下拉动画完成后立即回弹。  
**需求**：
1. 下拉触发时调用 `refetchDiscover()`（React Query refetch）
2. 刷新期间显示加载状态（spinner 或 skeleton）
3. 刷新完成后 Toast 提示「已刷新」

---

### F-04 语音朗读为 alert 占位

**文件**：`frontend/src/components/ChatScreen.tsx` ≈ L524–L548  
**现象**：点击语音按钮弹出 `alert()`，体验极差，且 B-08 中角色名显示为空。  
**需求（分两阶段）**：
- **阶段一（短期）**：移除 `alert`，改为 Toast 通知 `「暂不支持语音朗读，敬请期待」`，同时修复 B-08 变量插值
- **阶段二（中期）**：集成 Web Speech API (`SpeechSynthesis`) 实现基础 TTS：
  ```tsx
  const speak = (text: string) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    window.speechSynthesis.speak(utter);
  };
  ```
  - 朗读时按钮变为「停止」图标，点击可中断
  - 仅朗读 AI 消息（非用户消息）

---

### F-05 SettingsScreen 后端配置保存未校验

**文件**：`frontend/src/components/SettingsScreen.tsx`  
**现象**：后端 API 地址和 API Key 填写后，点击保存仅做本地 `localStorage` 存储，无任何连通性校验，用户填错地址后聊天会直接报错，无提前感知。  
**需求**：
1. 新增「测试连接」按钮，点击后发送 `GET /models`（或 `/ping`）请求验证地址可达性
2. 测试通过显示绿色 ✓ 和模型数量提示；失败显示红色 ✗ 和具体错误
3. 保存前若未测试过，显示警告提示「建议先测试连接」（非强制拦截）

---

## 三、P2 — 功能缺失（计划中未落地）

### N-01 聊天消息不支持 Markdown 渲染

**文件**：`frontend/src/components/ChatScreen.tsx`  
**现状**：消息内容使用 `<p className="whitespace-pre-wrap">{msg.text}</p>` 纯文本渲染，所有 Markdown 格式（**加粗**、*斜体*、代码块、> 引用）均以原始符号展示。  
**需求**：
1. 引入 `react-markdown` + `remark-gfm`，对 AI 回复消息启用 Markdown 渲染
2. 用户消息保持纯文本（`whitespace-pre-wrap`），不渲染 Markdown
3. 自定义渲染样式，与现有深色主题配色匹配：
   - `code` → monospace 字体 + `bg-surface-container` 底色
   - `blockquote` → 左侧 accent-pink 边框 + 灰色文字
   - `strong` → 亮白色加粗
4. 搜索高亮功能（B-06 修复后）在 Markdown 模式下仍需保持

**技术选型**：
```bash
pnpm add react-markdown remark-gfm
```

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// AI 消息
<ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
```

---

### N-02 角色初始问候语未使用 first_mes 字段

**文件**：`frontend/src/App.tsx`（handleStartChat 逻辑）  
**现状**：进入聊天后第一条 AI 消息为硬编码字符串（或角色 `greeting` 字段），未使用角色数据中标准的 `first_mes` 字段。  
**需求**：
1. 进入聊天时，若角色有 `first_mes` 字段，优先使用该字段作为开场白
2. 若无 `first_mes`，fallback 到 `greeting` → 默认占位文本
3. `first_mes` 支持 `{{char}}` / `{{user}}` 模板变量替换：
   ```ts
   const greet = (template: string, charName: string, userName: string) =>
     template.replace(/\{\{char\}\}/g, charName).replace(/\{\{user\}\}/g, userName);
   ```
4. 初始消息不发送给 AI，不计入上下文（纯展示）

---

### N-03 「停止生成」按钮缺失

**文件**：`frontend/src/components/ChatScreen.tsx`  
**现状**：AI 流式回复过程中，发送按钮变为动画点点，但无法中断生成，用户只能等待。  
**需求**：
1. `isStreaming === true` 时，发送按钮替换为「停止」图标（`Square` 或 `StopCircle`）
2. 点击停止后：调用 `AbortController.abort()` 中断 SSE 流，保留已接收的部分消息
3. 停止后消息尾部追加 `[已中断]` 灰色标记
4. 后端 `/api/chat/stream` 需支持客户端断连时正常关闭 SSE

```tsx
// 发送区域逻辑
{isStreaming ? (
  <button onClick={handleStop} title="停止生成">
    <Square className="w-3.5 h-3.5" />
  </button>
) : (
  <button type="submit" disabled={...}>
    <Send className="w-3.5 h-3.5" />
  </button>
)}
```

---

### N-04 多会话管理缺失（每角色仅一个会话）

**现状**：每个角色只有一条聊天记录，无法与同一角色开启多个独立剧情线，也无法重置对话。  
**需求**：
1. 新增「新对话」入口（聊天页头部菜单 → 「+ 新建对话」）
2. 数据结构：`chatId` 从当前的 `characterId` 改为 `characterId + sessionId`
3. 会话列表入口（聊天页侧滑或头部按钮），展示该角色的历史会话列表，按最新消息时间倒序
4. 支持删除整个会话（含二次确认）
5. 会话命名：默认「对话 #N」，支持长按重命名

> 注：此项改动涉及 `useChat` / `chatService` / 后端 `chats` 模块，工作量较大，建议独立迭代排期。

---

## 四、P3 — 体验 / 性能优化

### O-01 长对话性能：消息列表无虚拟滚动

**现状**：`ChatScreen` 将所有历史消息全量渲染到 DOM，对话超过 200 条后，滚动帧率明显下降，低端设备可能出现卡顿甚至 OOM。  
**需求**：
- 引入 `@tanstack/react-virtual`（已是 monorepo 友好库）实现消息列表虚拟滚动
- 仅渲染视口可见区域 ±buffer 条消息
- 新消息到达时自动滚动到底部行为保持不变

**评估**：影响范围广（涉及长按菜单定位、搜索滚动定位），建议在 N-01（Markdown 渲染）落地后统一处理渲染层。

---

### O-02 角色详情页缺少深链接 / 分享入口

**文件**：`frontend/src/components/CharacterDetailScreen.tsx`  
**现状**：角色详情页无独立 URL，无法通过链接直接打开某个角色的详情页，分享给他人需要对方自行搜索。  
**需求**：
1. 路由层支持 `/character/:id` 深链接，直接渲染对应角色详情
2. 详情页顶部增加「分享」按钮（`Share2` 图标）
3. 点击分享：复制当前页 URL 到剪贴板 + Toast 提示「链接已复制」
4. 分享链接打开时若角色不存在（已删除/私有），展示友好 404 页面

---

### O-03 消息时间戳格式优化

**文件**：`frontend/src/components/ChatScreen.tsx`  
**现状**：每条消息底部使用 `formatChatDate(msg.timestamp)` 展示完整时间戳，视觉上较占用空间且冗余。  
**需求**：
1. 当天消息只显示时间（`HH:mm`）
2. 昨天消息显示「昨天 HH:mm」
3. 更早的消息显示「M月D日」
4. 消息气泡 hover 时 tooltip 展示完整日期时间
5. 连续 5 分钟内同一方向的消息，折叠为消息组，仅最后一条显示时间戳（减少视觉噪音）

---

### O-04 发现页角色卡片缺少骨架屏

**文件**：`frontend/src/components/DiscoverScreen.tsx`  
**现状**：数据加载时直接显示空白区域，无加载状态反馈，首屏体验差。  
**需求**：
1. 初始加载时显示 6–8 张骨架屏卡片（与真实卡片等高，灰色渐变动画）
2. 搜索/标签切换时保留旧数据显示（不清空），数据返回后平滑替换
3. 错误状态时显示「加载失败，点击重试」

---

### O-05 创建角色表单缺少字段字数限制提示

**文件**：`frontend/src/components/CreateCharacterScreen.tsx`  
**现状**：`personality`、`scenario`、`first_mes` 等长文本字段无字数统计，用户不知道是否超限，且后端若有 token 限制时前端无任何提前告知。  
**需求**：
1. 长文本字段（`description` / `personality` / `scenario` / `first_mes` / `mes_example`）底部右对齐显示「当前 / 最大字符数」
2. 超过 80% 时变为橙色，超过 100% 时变红并阻止提交
3. 建议限制：`description` ≤ 500，`personality` ≤ 1000，`scenario` ≤ 2000，`first_mes` ≤ 1000

---

### O-06 消息编辑功能缺失

**文件**：`frontend/src/components/ChatScreen.tsx`  
**现状**：消息长按菜单提供「复制 / 重新生成 / 删除」，但缺少「编辑」能力，用户发送错字后只能删除重发。  
**需求**：
1. 用户消息长按菜单新增「编辑」按钮（`Pencil` 图标）
2. 点击后消息气泡变为内联编辑框，预填原文
3. 确认编辑后：更新消息内容 + 删除该消息之后的所有 AI 回复 + 自动触发重新生成
4. 编辑框支持 Escape 取消

---

## 五、已完成确认（无需重复规划）

| 编号 | 功能 | 对应 iteration-spec | 状态 |
|------|------|-------------------|------|
| ✅ | 发现页搜索 + Tag 标签筛选 | 2.2 发现页增强 | 已实现 |
| ✅ | 消息长按操作菜单（复制/重生成/删除） | 2.1 消息操作 | 已实现 |
| ✅ | 消息内搜索（关键词高亮+导航） | 2.3 消息搜索 | 已实现（B-06/B-07 需修复） |

---

## 六、需求优先级汇总

```
P0（本周必修）：B-01 ~ B-08（8个变量插值Bug）
P1（下周跟进）：F-01 搜索可用、F-02 用户头像、F-03 下拉刷新、F-04 语音占位优化、F-05 连接测试
P2（月内迭代）：N-01 Markdown渲染、N-02 first_mes、N-03 停止生成
P3（长期规划）：N-04 多会话、O-01 虚拟滚动、O-02 深链接、O-03 时间戳、O-04 骨架屏、O-05 字数限制、O-06 消息编辑
```

---

## 七、与现有文档的关系

| 现有文档 | 状态 | 说明 |
|---------|------|------|
| `refactor/iteration-spec.md` | 有效，继续使用 | P0-P4 规划整体有效；本文档补充其未覆盖的 Bug 修复与功能残缺 |
| `refactor/iteration-plan-privacy-type.md` | 有效，准备执行 | privacyType 完整实施计划已就绪，可按计划推进 |
| `auth-ux-optimization-spec.md` | 有效，准备执行 | 认证 UX 改造规划已就绪 |
| 本文档 | 新增 | 与上述文档正交，不重复，建议按优先级合并排期 |

---

*文档由全量代码审查自动生成，审查时间：2026-06-10*
