# Auth Pages UX Optimization Spec

> **创建日期**: 2026-06-08
> **目标**: 优化登录/注册相关页面在移动端浏览器中的用户体验，解决高度溢出、内容不全、键盘遮挡等问题。

---

## 1. 问题概述

### 1.1 受影响页面
| 页面 | 路由 | 主要问题 |
|------|------|----------|
| LoginScreen | `/login` | 内容溢出、输入框被键盘遮挡 |
| EmailLoginScreen | `/login`（合并后） | 与 LoginScreen 功能重复，需合并 |
| RegisterScreen | `/register` | **最严重** — 4个字段 + 标题 + 头像 + 条款，短屏设备内容截断 |
| ForgotPasswordScreen | `/forgot-password` | 溢出问题 |
| ResetPasswordScreen | `/reset-password` | 溢出问题 |

### 1.2 不受影响页面
- WelcomeScreen (`/`) — 当前布局在小屏上表现尚可

### 1.3 目标设备
- **最低支持**: iPhone 12/13 级别 (390×844)
- **操作系统**: iOS Safari + Android Chrome
- **当前根因**: App.tsx 外层容器 `h-dvh overflow-hidden` 配合各页面 `flex-1 flex-col justify-between` + fixed header 占用空间，导致内容在短屏上被裁剪

---

## 2. 核心设计决策

| 决策项 | 方案 |
|--------|------|
| 溢出处理 | **压缩 + 滚动结合** — 先缩小间距/字号适配，必要时允许滚动 |
| Header 行为 | **智能切换** — 内容不溢出时固定，溢出时随内容滚动 |
| 键盘遮挡 | **自动滚动到当前输入框** (scrollIntoView / visualViewport API) |
| 注册页 | **保持单页**，压缩元素间距；不拆分步骤 |
| 提交按钮 | **始终可见 (sticky footer)** |
| 小屏头像 | **保持最小尺寸**（如 w-20），不隐藏 |
| 登录页 | **合并 LoginScreen + EmailLoginScreen** 为一个统一登录页 |

---

## 3. 详细实施方案

### 3.1 外层容器调整 (App.tsx)

**现状问题**: `h-dvh overflow-hidden` 导致内容溢出时被裁剪无法滚动。

**修改方案**:
- 对于 auth 路由（`/`, `/login`, `/register`, `/forgot-password`, `/reset-password`），外层容器允许 `overflow-y: auto`
- 或：将 `overflow-hidden` 替换为 `overflow-y-auto`，保持 `x-hidden`
- 确保 `min-h-dvh` 替代 `h-dvh`，允许内容自然撑开

```tsx
// Before
<div className="h-dvh ... overflow-hidden">

// After (for auth pages)
<div className="min-h-dvh ... overflow-y-auto overflow-x-hidden">
```

### 3.2 页面布局统一调整

#### 3.2.1 布局模式

**现状**: `flex-1 flex flex-col justify-between p-6`

**修改为**:
```
min-h-dvh flex flex-col
  ├── header (sticky top-0, z-50, h-14) ← 缩小高度 16→14
  ├── main (flex-1 flex flex-col justify-center, px-6, py-4)
  │   ├── 头像区（可缩小）
  │   ├── 标题区
  │   ├── 表单区（可滚动，max-h 限制）
  │   └── spacer
  └── footer (sticky bottom-0, 提交按钮)
```

#### 3.2.2 间距压缩策略

| 元素 | 当前值 | 压缩后 | 条件 |
|------|--------|--------|------|
| Header 高度 | `h-16` (64px) | `h-14` (56px) | 全局 |
| 主内容顶部 padding | `pt-28` | `pt-16` | 全局 |
| 主内容底部 padding | `pb-12` | `pb-20` (给 sticky footer 留空间) | 全局 |
| 头像大小（登录页） | `w-28 h-28` | `w-20 h-20` (小屏) / `w-24 h-24` (正常) | 媒体查询 |
| 头像大小（注册页） | `w-32 h-32` | `w-20 h-20` (小屏) / `w-24 h-24` (正常) | 媒体查询 |
| 标题字号 | `text-2xl` | `text-xl` | 小屏 |
| 输入框 padding | `py-3.5` | `py-2.5` (小屏) / `py-3` (正常) | 媒体查询 |
| 表单间距 | `space-y-5` | `space-y-3` (小屏) | 媒体查询 |
| 分隔线上下间距 | `my-6` / `my-8` | `my-3` | 全局 |

#### 3.2.3 响应式断点

使用 Tailwind 的 `@media` 或 CSS 自定义媒体查询：

```css
/* 小屏设备 (< 400px 高度 或 < 390px 宽度) */
@media (max-height: 700px) or (max-width: 390px) {
  /* 应用压缩样式 */
}
```

推荐使用 container queries 或 JS 检测 `window.innerHeight` 动态添加类名。

### 3.3 登录页合并方案

#### 3.3.1 合并策略

- **保留 LoginScreen** 作为唯一登录页，删除 `EmailLoginScreen`
- 路由 `/login` 指向合并后的 LoginScreen
- WelcomeScreen 中的「使用邮箱登录」按钮也指向 `/login`
- RegisterScreen 中的「立即登录」链接也指向 `/login`

#### 3.3.2 LoginScreen 改进点

- 将 `EmailLoginScreen` 的优良特性合并进来（如果有的话）
- 统一中文文案（EmailLoginScreen 中有混用的英文文案）
- 保留 LoginScreen 的错误处理、loading 状态、密码显示切换、忘记密码链接等
- 清理 `EmailLoginScreen` 路径引用，更新 `SCREEN_PATHS`

#### 3.3.3 删除清单

- 删除 `frontend/src/components/EmailLoginScreen.tsx`
- 从 `App.tsx` 中移除 EmailLoginScreen 的 lazy import 和 Route
- 更新所有 `ScreenId.EMAIL_LOGIN` 引用为 `ScreenId.LOGIN`（或重命名 EMAIL_LOGIN 为 LOGIN）
- 更新 ForgotPasswordScreen 中的返回导航（从 EMAIL_LOGIN → LOGIN）

### 3.4 Sticky Footer 实现

#### 3.4.1 提交按钮

每个表单页面的提交按钮固定于页面底部：

```tsx
<div className="sticky bottom-0 bg-background-deep/95 backdrop-blur-xl border-t border-outline-variant/30 px-6 py-3 safe-bottom">
  <button type="submit" className="w-full ...">
    {loading ? '登录中...' : '连接登录'}
  </button>
</div>
```

#### 3.4.2 适用页面

- LoginScreen: sticky「连接登录」按钮
- RegisterScreen: sticky「注册」按钮
- ForgotPasswordScreen: sticky「发送恢复码」按钮
- ResetPasswordScreen: sticky「重置密码」按钮

### 3.5 键盘处理方案

#### 3.5.1 自动滚动到当前输入框

使用 `visualViewport` API + `scrollIntoView`：

```tsx
// 在输入框 onFocus 时
const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  // 延迟执行，等键盘完全弹出
  setTimeout(() => {
    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
};
```

#### 3.5.2 visualViewport 监听（可选增强）

```tsx
useEffect(() => {
  const handleResize = () => {
    if (window.visualViewport) {
      const keyboardHeight = window.innerHeight - window.visualViewport.height;
      // 如果是键盘弹出，调整布局
      if (keyboardHeight > 150) {
        // 键盘已弹出，可能需要调整 main 区域的 padding/margin
      }
    }
  };
  window.visualViewport?.addEventListener('resize', handleResize);
  return () => window.visualViewport?.removeEventListener('resize', handleResize);
}, []);
```

### 3.6 Header 智能切换方案

#### 3.6.1 实现思路

检测内容是否溢出 → 动态切换 header 定位：

```tsx
const [isOverflowing, setIsOverflowing] = useState(false);

useEffect(() => {
  const checkOverflow = () => {
    const mainEl = mainRef.current;
    if (mainEl) {
      // 内容高度 + header高度 > 视口高度
      const overflow = mainEl.scrollHeight + HEADER_HEIGHT > window.innerHeight;
      setIsOverflowing(overflow);
    }
  };
  checkOverflow();
  window.addEventListener('resize', checkOverflow);
  return () => window.removeEventListener('resize', checkOverflow);
}, []);

// header 根据溢出状态切换定位
<header className={isOverflowing 
  ? 'relative ...' 
  : 'sticky top-0 z-50 ...'
}>
```

或简化版：直接使用 `sticky top-0` 替代 `fixed`，让 header 在滚动时自然跟随。

### 3.7 响应式头像处理

```tsx
// 使用 Tailwind 响应式类名（需要配置 height breakpoints）
// 或使用 JS 动态判断

const isSmallScreen = typeof window !== 'undefined' && window.innerHeight < 700;

<div className={cn(
  "relative mb-6 group",
  isSmallScreen ? "w-20 h-20" : "w-28 h-28"
)}>
```

### 3.8 字体预加载更新

`index.html` 中的字体预加载 URL 当前只包含部分字符：
```
&text=YuzuAINeonFrontierExplorethe0123456789
```

**需要更新为完整中文字符集**，以覆盖汉化后的所有文案。建议移除 `text=` 参数改为完整字体加载，或扩展字符集包含所有中文 UI 文案。

---

## 4. 文件变更清单

### 4.1 修改文件

| 文件 | 变更内容 |
|------|----------|
| `frontend/src/App.tsx` | 更新路由容器 overflow 行为；合并登录页路由；更新 SCREEN_PATHS |
| `frontend/src/components/LoginScreen.tsx` | 全面重构：sticky footer、键盘处理、响应式压缩、智能 header |
| `frontend/src/components/RegisterScreen.tsx` | 全面重构：sticky footer、键盘处理、响应式压缩、智能 header |
| `frontend/src/components/ForgotPasswordScreen.tsx` | sticky footer、键盘处理、响应式压缩 |
| `frontend/src/components/ResetPasswordScreen.tsx` | sticky footer、键盘处理、响应式压缩 |
| `frontend/src/components/WelcomeScreen.tsx` | 更新「使用邮箱登录」导航目标 |
| `frontend/src/index.css` | 添加响应式工具类、小屏压缩样式 |
| `frontend/index.html` | 更新字体预加载字符集 |
| `frontend/src/types.ts` | 可能需要更新 ScreenId 枚举（合并 EMAIL_LOGIN） |

### 4.2 删除文件

| 文件 | 原因 |
|------|------|
| `frontend/src/components/EmailLoginScreen.tsx` | 与 LoginScreen 合并 |

### 4.3 引用更新

- 所有 `onNavigate(ScreenId.EMAIL_LOGIN)` → `onNavigate(ScreenId.LOGIN)`
- 路由 `/login` 绑定到合并后的 LoginScreen
- ForgotPasswordScreen 返回导航目标更新

---

## 5. 实现步骤

1. **创建 auth 布局容器组件** — 可复用的 `AuthLayout` 组件，封装 sticky header/footer 逻辑
2. **重构 LoginScreen** — 合并 EmailLoginScreen 功能，添加响应式压缩、键盘处理
3. **重构 RegisterScreen** — 响应式压缩、sticky footer、键盘处理
4. **重构 ForgotPasswordScreen / ResetPasswordScreen** — 统一布局
5. **更新 App.tsx** — 清理路由、合并登录页、更新容器 overflow 行为
6. **更新 index.css** — 添加响应式工具类
7. **更新 index.html** — 字体预加载
8. **清理** — 删除 EmailLoginScreen，更新所有引用
9. **类型检查 + 构建验证**

---

## 6. 验收标准

- [ ] 在 iPhone 12/13 (390×844) 模拟器上，所有 auth 页面内容完整可见
- [ ] 键盘弹出时，当前输入框自动滚动到可见区域
- [ ] 提交按钮始终在页面底部可见（不随滚动消失或需要滚动才能看到）
- [ ] RegisterScreen 在 390×844 上无需外部滚动即可看到所有4个字段
- [ ] Header 在内容未溢出时固定，溢出时正常滚动
- [ ] 登录页功能完整：用户名/邮箱 + 密码登录 + Google 登录 + 忘记密码 + 跳转注册
- [ ] EmailLoginScreen 已删除，所有导航引用已更新
- [ ] TypeScript 编译通过，Vite build 成功
- [ ] 暗色主题样式不变，现有视觉风格保持一致
