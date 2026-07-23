import { type ReactNode, useRef, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';

interface AuthLayoutProps {
  /** 页面标题，显示在 header 中间 */
  title: string;
  /** 返回按钮的导航目标 */
  onBack: () => void;
  /** 主内容区域 */
  children: ReactNode;
  /** Sticky footer 内容（通常是提交按钮） */
  footer?: ReactNode;
  /** 显示在 back 按钮上的文字，默认「返回」 */
  backLabel?: string;
  /** 自定义 header 右侧内容（可选） */
  headerRight?: ReactNode;
}

/**
 * 认证页面通用布局组件
 * 
 * 特性：
 * - Sticky header：返回按钮 + 标题，始终在顶部
 * - 可滚动主内容区：flex-1 居中布局
 * - Sticky footer：提交按钮固定在底部（键盘弹出时自动隐藏避免遮挡）
 * - 响应式压缩：小屏自动缩小间距
 * - 键盘处理：focus 时自动 scrollIntoView
 */
export default function AuthLayout({
  title,
  onBack,
  children,
  footer,
  backLabel = '返回',
  headerRight,
}: AuthLayoutProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // 监听键盘弹出/收起（visualViewport API）
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportResize = () => {
      const vv = window.visualViewport!;
      const keyboardHeight = window.innerHeight - vv.height;
      setKeyboardVisible(keyboardHeight > 100);
    };

    window.visualViewport.addEventListener('resize', handleViewportResize);
    return () => {
      window.visualViewport?.removeEventListener('resize', handleViewportResize);
    };
  }, []);


  return (
    <div className="h-dvh flex flex-col bg-background-deep">
      {/* Glow Rings - 装饰性光晕 */}
      <div className="fixed top-1/4 -left-10 w-40 h-40 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="fixed bottom-1/4 -right-10 w-60 h-60 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header
        className="app-header z-50 flex items-center justify-between px-4 bg-background-deep/80 backdrop-blur-xl border-b border-outline-variant/30 shrink-0"
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">{backLabel}</span>
        </button>

        <h1 className="font-headline-lg-mobile text-base font-bold text-accent-pink text-center">
          {title}
        </h1>

        {headerRight || <div className="w-10" />}
      </header>

      {/* Main Content - 可滚动，居中 */}
      <main
        ref={mainRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-start sm:justify-center px-5 py-3 w-full max-w-md mx-auto z-10 gap-3 sm:gap-4"
        data-auth-main
      >
        {children}
      </main>

      {/* Footer - 键盘弹出时隐藏 */}
      {footer && !keyboardVisible && (
        <div className="app-bottom-bar bg-background-deep/95 backdrop-blur-xl border-t border-outline-variant/30 px-5 py-3 z-10 shrink-0">
          {footer}
        </div>
      )}
    </div>
  );
}
