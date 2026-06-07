# SimpleTavern 前端用户体验优化 — 技术规约

> 本文档基于多轮用户访谈生成，记录了所有确认的需求、设计决策和实现方案。
> 范围：1-2周全面优化 | 目标：增强用户体验，保持现有赛博朋克风格

---

## 一、项目背景

### 当前架构
- **技术栈**：React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + motion v12 + @tanstack/react-query
- **路由**：手动路由，基于 `ScreenId` 枚举 + `AnimatePresence` 页面切换
- **状态管理**：`useState`(UI状态) + React Query(服务端状态)
- **14个Screen**，React.lazy懒加载代码分割
- **Service Worker**：已实现3种缓存策略（Stale-While-Revalidate / Cache-First / Network-First）
- **生产部署**：Docker Compose，Nginx反向代理，`https://chat.hhxxttxs.icu`

### 设计约束
- 语言：仅中文
- 无障碍：暂不需要
- 主题：仅暗色赛博朋克主题，不引入主题切换
- 国际化：不需要
- 设置页：保持现有即可
- 聊天输入：保持现有
- 错误处理：保持现有Toast机制

---

## 二、优化目标与优先级

| 优先级 | 模块 | 核心目标 |
|--------|------|---------|
| P0 | 聊天体验 | 发送队列管理 + 状态可视化，解决"消息发送后长时间无响应" |
| P0 | 首屏性能 | 品牌Splash Screen + LCP优化 + 渐进式加载 |
| P1 | PWA | 可安装 + 离线静态资源 + 离线聊天历史(IndexedDB) |
| P1 | 角色列表 | 虚拟滚动 + 渐进式图片加载 |
| P2 | 移动端交互 | 下拉刷新、左滑操作、双击点赞 |
| P2 | 交互动效 | 微交互增强（hover/press）+ 保持现有赛博朋克风格 |
| P3 | 角色详情 | 评价系统优化 |
| P3 | 数据埋点 | 基础页面浏览+事件追踪 |

---

## 三、详细方案

### 3.1 聊天体验优化（P0）

#### 3.1.1 发送队列管理
**问题**：快速连续发送消息时，状态错乱，无并发控制。

**方案**：
- 在 `App.tsx` 的 `handleSendMessage` 中增加队列管理
- 同一角色只允许一个进行中的请求
- 发送中时禁用发送按钮 + 显示 "AI正在回复中..."
- 新增多个发送状态：`idle | sending | streaming | done | error`

**文件变更**：
- `frontend/src/App.tsx` — 增加 `sendingState` Map
- `frontend/src/components/ChatScreen.tsx` — 发送按钮状态联动
- `frontend/src/types.ts` — 增加 `SendState` 类型

#### 3.1.2 发送状态可视化
**方案**：
- 发送按钮根据状态显示不同图标/文案：
  - `idle` → Send图标 + "发送"
  - `sending` → Loader + "排队中..."
  - `streaming` → 脉动圆点 + "回复中..."
  - `error` → 红色图标 + "重试"
- SSE流式接收中时，输入框区域显示动态状态文本

**实现细节**：
```
// 状态机
idle → sending → streaming → done
                  ↓
                 error → idle (可重试)
```

---

### 3.2 首屏性能优化（P0）

#### 3.2.1 品牌 Splash Screen
**方案**：
- 替换当前 `🔄 正在连接服务器...` 为品牌启动画面
- YuzuAI Logo居中，带赛博朋克风格的霓虹光晕动画
- 显示时间：~1.5s（或等 useCurrentUser 完成）
- 品牌标语："连接神经矩阵中..."

**文件变更**：
- `frontend/src/App.tsx` — 修改 loading 状态渲染
- 可复用 `src/components/SplashScreen.tsx`（新建）

#### 3.2.2 LCP 优化
**方案**：
- 预加载关键资源（Logo、首屏字体）
- `<link rel="preload">` 在 index.html 中预加载 `/yuzuai_logo.png`
- 字体子集化，只加载首屏需要的字符
- 移除或延迟非关键CSS动画的初始化
- React.lazy 的 `Suspense fallback` 增加预连接提示

**文件变更**：
- `frontend/index.html` — 增加 preload 标签
- `frontend/src/index.css` — 字体加载优化

#### 3.2.3 CLS 优化
**方案**：
- 所有 `<img>` 标签显式设置 `width`/`height` 或使用 `aspect-ratio`
- `LazyImage` 组件增加占位 aspect-ratio
- 骨架屏尺寸与实际卡片严格一致

**文件变更**：
- `frontend/src/components/LazyImage.tsx` — 增加 aspect-ratio 占位
- `frontend/src/components/Skeleton.tsx` — 尺寸对齐检查
- 各Screen组件中图片标签审查

---

### 3.3 PWA 完整体验（P1）

#### 3.3.1 可安装到主屏幕
**方案**：
- 完善 `manifest.json`（已有基础），增加：
  - `display: "standalone"`
  - `orientation: "portrait"`
  - 合适的图标尺寸（192x192, 512x512）
  - `theme_color: "#090A0F"`
  - `background_color: "#090A0F"`
- 增加安装提示（beforeinstallprompt 事件监听）
- 独立窗口优化：安全区域适配（已部分完成）

**文件变更**：
- `frontend/public/manifest.json` — 完善配置
- `frontend/src/sw-register.ts` — 增加安装提示逻辑
- `frontend/index.html` — `<meta name="apple-mobile-web-app-capable">` 等

#### 3.3.2 离线静态资源缓存增强
**方案**：
- SW安装时预缓存所有静态资源（JS chunk、CSS、字体、Logo）
- 当前已实现 `Cache-First` 用于静态资源，审查是否覆盖完整
- 版本号自动递增（deploy-prd.sh已实现）

**文件变更**：
- `frontend/public/sw.js` — 扩展预缓存列表
- `frontend/vite.config.ts` — 确保构建产物可被SW识别

#### 3.3.3 离线聊天历史（IndexedDB）
**方案**：
- 引入 `idb` 库（轻量 IndexedDB wrapper）
- 实现 `ChatCache` 工具类：
  - `saveMessages(characterId, messages)` — 发送/接收后保存
  - `getMessages(characterId)` — 优先从DB读取
  - `getAllThreads()` — 离线时显示缓存线程列表
- 在线时：API获取 → 更新DB缓存
- 离线时：从DB读取 → 显示离线提示条

**文件变更**：
- `frontend/src/utils/chatCache.ts` — 新建 IndexedDB 缓存工具
- `frontend/src/api/chat.ts` — 集成缓存读写
- `frontend/src/components/ChatScreen.tsx` — 离线状态提示
- `frontend/src/components/MessageCenterScreen.tsx` — 离线线程列表

**新增依赖**：
- `idb` (^8.x) — IndexedDB wrapper

#### 3.3.4 推送通知
**方案**：
- 前端：注册 Service Worker `push` 事件
- 后端：需要新增 Web Push 端点（本次范围待确认）
- 前端先实现权限请求和 subscription 注册
- 通知内容："[角色名] 回复了你的消息" / "新角色上线" 等

**文件变更**：
- `frontend/public/sw.js` — 增加 push 事件处理
- `frontend/src/sw-register.ts` — 增加通知权限请求
- `frontend/src/components/SettingsScreen.tsx` — 通知开关（可选）

---

### 3.4 角色列表虚拟滚动（P1）

#### 3.4.1 虚拟滚动实现
**问题**：所有角色一次性渲染，角色数量多时性能下降。

**方案**：
- 引入 `@tanstack/react-virtual`（与现有 @tanstack/react-query 同生态）
- DiscoverScreen 角色列表改为虚拟滚动
- 卡片高度固定为估算值（约320px），实际渲染时动态测量
- 保留现有搜索/标签筛选（过滤后再虚拟滚动）

**文件变更**：
- `frontend/src/components/DiscoverScreen.tsx` — 改用 VirtualList
- `frontend/package.json` — 增加 `@tanstack/react-virtual`

**新增依赖**：
- `@tanstack/react-virtual` (^3.x)

#### 3.4.2 渐进式图片加载
**方案**：
- `LazyImage` 组件增强：先显示低质量缩略图(blur-up)，再加载高清图
- 需要后端配合提供缩略图端点（或前端生成）
- 方案A（推荐）：LazyImage先显示模糊占位色块（取角色avatarColor），图片加载后渐显
- 方案B：后端提供 `?thumb=true` 缩略图端点

**文件变更**：
- `frontend/src/components/LazyImage.tsx` — blur-up效果
- `frontend/src/index.css` — blur-up动画

---

### 3.5 移动端交互增强（P2）

#### 3.5.1 下拉刷新
**方案**：
- DiscoverScreen 顶部增加下拉刷新手势
- 使用 `touchstart/touchmove/touchend` 实现或引入轻量库
- 刷新图标：赛博朋克风格的霓虹脉冲动画
- 触发 `refetch` 刷新React Query缓存

**文件变更**：
- `frontend/src/components/DiscoverScreen.tsx` — 增加 PullToRefresh
- 可抽取为 `frontend/src/components/PullToRefresh.tsx` 通用组件

#### 3.5.2 左滑操作
**方案**：
- MessageCenterScreen 聊天列表项支持左滑
- 左滑露出操作按钮：置顶/取消置顶、删除
- 使用 `touch` 事件实现，参考iOS短信左滑体验
- 配合 `motion` 实现弹性动画

**文件变更**：
- `frontend/src/components/MessageCenterScreen.tsx` — 左滑操作
- 可抽取为 `frontend/src/components/SwipeableRow.tsx` 通用组件

#### 3.5.3 双击点赞
**方案**：
- 角色卡片双击/双指触 → 触发收藏切换
- DiscoverScreen / CharacterDetailScreen 的角色头像区域
- 双击时有心形动画反馈（motion spring动画）

**文件变更**：
- `frontend/src/components/DiscoverScreen.tsx` — 双击收藏
- `frontend/src/components/CharacterDetailScreen.tsx` — 双击收藏

---

### 3.6 交互动效增强（P2）

#### 3.6.1 微交互打磨
**方案**（保持现有赛博朋克风格）：
- 按钮 hover 态：霓虹边框光晕效果增强
- 卡片 hover：微缩放(scale: 1.02) + 边框发光
- 页面切换：优化 AnimatePresence 动画，增加霓虹扫描线过渡
- Toast 通知：增加赛博朋克风格的边框扫描线动画
- 滚动条：增强霓虹粉色的滚动条样式

**文件变更**：
- `frontend/src/index.css` — 全局微交互样式
- 各 Screen 组件 — hover 态样式调整

#### 3.6.2 加载状态动画
**方案**：
- 骨架屏增加霓虹扫描线动画（shimmer效果）
- 与现有赛博朋克配色（pink/purple）一致

**文件变更**：
- `frontend/src/components/Skeleton.tsx` — shimmer动画
- `frontend/src/index.css` — shimmer keyframes

---

### 3.7 角色评价系统优化（P3）

#### 3.7.1 评价体验改进
**方案**：
- 评分从5星改为更直观的交互
- 增加快捷评价标签（如"角色还原度高"、"对话有趣"、"设定详细"）
- 评价列表增加分页/折叠
- 显示评价总数和平均分更加突出
- 评价提交后乐观更新

**文件变更**：
- `frontend/src/components/CharacterDetailScreen.tsx` — 评价UI重构
- `frontend/src/api/characters.ts` — 可能需要新增评价API

---

### 3.8 数据埋点（P3）

#### 3.8.1 基础事件追踪
**方案**：
- 页面浏览追踪（ScreenId变化时上报）
- 关键事件追踪：发送消息、收藏角色、创建角色、搜索、登录
- 使用轻量方案：自定义 `Analytics` 工具类
- 数据发送到后端 `/api/analytics/events`（或第三方服务）
- 性能指标上报（LCP/INP/CLS via web-vitals）

**文件变更**：
- `frontend/src/utils/analytics.ts` — 新建埋点工具
- `frontend/src/App.tsx` — 集成页面浏览追踪
- 各Screen组件 — 关键事件埋点

**新增依赖**（可选）：
- `web-vitals` — Web Vitals指标采集

---

## 四、实现顺序与里程碑

### 第一阶段（Day 1-3）：核心体验
1. Splash Screen 品牌启动画面
2. 发送队列管理 + 状态可视化
3. CLS 修复（图片显式尺寸、骨架屏对齐）

### 第二阶段（Day 4-7）：PWA + 性能
4. PWA 完整配置（manifest、安装提示、离线静态资源）
5. IndexedDB 离线聊天历史
6. 虚拟滚动（DiscoverScreen角色列表）
7. LCP 优化（预加载、字体子集）

### 第三阶段（Day 8-11）：交互增强
8. 渐进式图片加载（blur-up）
9. 下拉刷新
10. 左滑操作
11. 双击点赞

### 第四阶段（Day 12-14）：打磨
12. 交互动效增强（hover/press/滚动条/shimmer）
13. 角色评价系统优化
14. 数据埋点集成
15. 整体测试、性能验证、Bug修复

---

## 五、文件变更清单

### 新建文件
| 文件 | 说明 |
|------|------|
| `frontend/src/components/SplashScreen.tsx` | 品牌启动画面 |
| `frontend/src/components/PullToRefresh.tsx` | 下拉刷新通用组件 |
| `frontend/src/components/SwipeableRow.tsx` | 左滑操作通用组件 |
| `frontend/src/utils/chatCache.ts` | IndexedDB聊天缓存工具 |
| `frontend/src/utils/analytics.ts` | 数据埋点工具 |

### 修改文件
| 文件 | 改动内容 |
|------|---------|
| `frontend/src/App.tsx` | 发送队列管理、Splash渲染、埋点集成 |
| `frontend/src/types.ts` | SendState类型、Analytics事件类型 |
| `frontend/src/components/ChatScreen.tsx` | 发送状态可视化、离线提示 |
| `frontend/src/components/DiscoverScreen.tsx` | 虚拟滚动、下拉刷新、双击点赞、渐进图片 |
| `frontend/src/components/MessageCenterScreen.tsx` | 左滑操作、离线线程 |
| `frontend/src/components/CharacterDetailScreen.tsx` | 评价系统优化、双击点赞 |
| `frontend/src/components/LazyImage.tsx` | aspect-ratio占位、blur-up效果 |
| `frontend/src/components/Skeleton.tsx` | shimmer动画 |
| `frontend/src/components/BottomNav.tsx` | 徽标计数优化 |
| `frontend/src/index.css` | 全局微交互样式、shimmer动画 |
| `frontend/index.html` | preload标签、PWA meta标签 |
| `frontend/public/manifest.json` | PWA完整配置 |
| `frontend/public/sw.js` | 预缓存扩展、push事件、离线策略 |
| `frontend/src/sw-register.ts` | 安装提示、通知权限 |
| `frontend/src/api/chat.ts` | 聊天缓存集成 |

### 新增依赖
| 包名 | 用途 | 版本 |
|------|------|------|
| `@tanstack/react-virtual` | 虚拟滚动 | ^3.x |
| `idb` | IndexedDB wrapper | ^8.x |
| `web-vitals` | Web Vitals采集 | ^4.x |

---

## 六、验收标准

### 性能
- [ ] LCP < 2.5s（首屏内容渲染）
- [ ] INP < 200ms（交互响应）
- [ ] CLS < 0.1（视觉稳定性）
- [ ] 首屏 JS bundle 增长 < 20KB（gzipped）

### 聊天
- [ ] 连续快速发送3条消息，状态正确，无错乱
- [ ] 发送中时发送按钮正确禁用
- [ ] AI回复中显示 "回复中..." 状态
- [ ] 流式输出中途断连有明确提示

### PWA
- [ ] Chrome 可安装到桌面（出现安装提示）
- [ ] 离线打开应用显示缓存内容（非白屏）
- [ ] 离线可查看历史聊天记录
- [ ] manifest.json 配置完整且合法

### 列表
- [ ] 50+角色列表滚动流畅（60fps）
- [ ] 图片加载无布局抖动
- [ ] 下拉刷新手势可用
- [ ] 左滑操作流畅

### 视觉
- [ ] Splash Screen 品牌动画正常
- [ ] hover/press 态有微交互反馈
- [ ] 骨架屏有shimmer动画
- [ ] 整体风格保持赛博朋克一致

---

## 七、风险与注意事项

1. **@tanstack/react-virtual 与现有布局兼容性**：虚拟列表需要固定高度估算，当前卡片高度不一致需要统一处理
2. **IndexedDB 存储容量**：移动端 Safari 有存储限制（~500MB），需注意清理策略
3. **Push Notification**：需要后端配合新增 Web Push API 端点，本规约仅覆盖前端实现
4. **Service Worker 更新**：SW变更后需要确保旧版本正确清理，避免缓存冲突
5. **不破坏现有功能**：所有优化应在保持现有14页结构和API不改动的前提下进行
