/**
 * 骨架屏组件 - 用于数据加载时的占位展示
 *
 * 提供多种预设骨架屏，也可自定义
 */

// 基础骨架块
export function SkeletonBlock({
  className = '',
  animate = true,
}: {
  className?: string;
  animate?: boolean;
}) {
  return (
    <div
      className={`
        bg-surface-container/50 rounded
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  );
}

// 角色卡片骨架屏
export function CharacterCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden bg-surface-container/30 border border-outline-variant/20">
      {/* 图片区域 */}
      <SkeletonBlock className="aspect-[4/3] rounded-none" />
      {/* 信息区域 */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-3 w-16" />
        </div>
        <SkeletonBlock className="h-3 w-full" />
        <SkeletonBlock className="h-3 w-3/4" />
        <div className="flex gap-2 pt-1">
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
          <SkeletonBlock className="h-3 w-16" />
          <SkeletonBlock className="h-8 w-20 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// 角色列表骨架屏
export function CharacterListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <CharacterCardSkeleton key={i} />
      ))}
    </div>
  );
}

// 聊天消息骨架屏
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && <SkeletonBlock className="w-8 h-8 rounded-full" />}
      <div className="space-y-2 max-w-[80%]">
        <SkeletonBlock className={`h-16 w-48 rounded-2xl ${isUser ? 'rounded-tr-none' : 'rounded-tl-none'}`} />
        <SkeletonBlock className="h-3 w-20" />
      </div>
    </div>
  );
}

// 聊天列表骨架屏
export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-surface-container/40 border border-outline-variant/20 p-4 rounded-xl flex items-center gap-4"
        >
          <SkeletonBlock className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="h-3 w-12" />
            </div>
            <SkeletonBlock className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 个人资料骨架屏
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* 用户信息卡片 */}
      <div className="bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border border-accent-pink/20 rounded-3xl p-6 flex flex-col items-center text-center space-y-4">
        <SkeletonBlock className="w-24 h-24 rounded-full" />
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="h-3 w-48" />
        <div className="flex gap-8 pt-2 w-full justify-around">
          <div className="text-center space-y-1">
            <SkeletonBlock className="h-3 w-12 mx-auto" />
            <SkeletonBlock className="h-4 w-8 mx-auto" />
          </div>
          <div className="text-center space-y-1">
            <SkeletonBlock className="h-3 w-12 mx-auto" />
            <SkeletonBlock className="h-4 w-8 mx-auto" />
          </div>
        </div>
      </div>
      {/* 菜单项 */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/20"
          >
            <div className="flex items-center gap-3">
              <SkeletonBlock className="w-4 h-4 rounded" />
              <SkeletonBlock className="h-4 w-24" />
            </div>
            <SkeletonBlock className="w-3.5 h-3.5 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 角色详情骨架屏
export function CharacterDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero 区域 */}
      <div className="relative w-full h-[320px] overflow-hidden border-b border-outline-variant/30 bg-surface-container/30">
        <div className="absolute inset-0 flex flex-col justify-center items-center py-6">
          <SkeletonBlock className="w-28 h-28 rounded-2xl" />
          <SkeletonBlock className="h-6 w-32 mt-4" />
          <SkeletonBlock className="h-3 w-24 mt-2" />
        </div>
      </div>
      {/* 统计卡片 */}
      <div className="grid grid-cols-3 gap-4 px-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      {/* 描述区域 */}
      <div className="px-6 space-y-4">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-24 w-full rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-6 w-16 rounded-full" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
          <SkeletonBlock className="h-6 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// 通用页面骨架屏 - 用于整个页面加载
export function PageSkeleton() {
  return (
    <div className="relative flex-1 bg-background-deep text-white pb-24 animate-pulse">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-40 bg-background-deep/80 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-outline-variant/20">
        <SkeletonBlock className="w-8 h-8 rounded-full" />
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="w-8 h-8 rounded-full" />
      </div>
      {/* 内容区域 */}
      <main className="px-6 py-6 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} className="h-32 rounded-xl" />
        ))}
      </main>
    </div>
  );
}

// 内联加载指示器
export function InlineLoader({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4 text-on-surface-variant">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {text && <span className="text-xs">{text}</span>}
    </div>
  );
}

// 全屏加载
export function FullScreenLoader({ text = '加载中...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-background-deep/90 backdrop-blur-md flex flex-col items-center justify-center z-50">
      <div className="flex gap-2 mb-4">
        <span className="w-3 h-3 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-3 h-3 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-3 h-3 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      {text && <p className="text-sm text-on-surface-variant">{text}</p>}
    </div>
  );
}

export default SkeletonBlock;
