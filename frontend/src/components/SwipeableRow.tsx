import { useRef, useState, useCallback, type ReactNode } from 'react';
import { Pin, PinOff, Trash2 } from 'lucide-react';

interface SwipeAction {
  label: string;
  icon: ReactNode;
  color: 'pink' | 'red' | 'purple';
  onAction: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  actions: SwipeAction[];
  /** 触发操作的滑动距离阈值（px），默认 80 */
  threshold?: number;
  /** 操作按钮宽度（px），默认 64 */
  actionWidth?: number;
}

const colorMap = {
  pink: 'bg-accent-pink/20 border-accent-pink/40 text-accent-pink',
  red: 'bg-red-500/20 border-red-500/40 text-red-300',
  purple: 'bg-accent-purple/20 border-accent-purple/40 text-accent-purple',
};

export default function SwipeableRow({
  children,
  actions,
  threshold = 80,
  actionWidth = 64,
}: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const swipeDirection = useRef<'horizontal' | 'vertical' | null>(null);
  const hasSwiped = useRef(false); // 标记是否发生了有效滑动

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = true;
    swipeDirection.current = null;
    hasSwiped.current = false;
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isSwiping.current) return;
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;

      // 第一次移动时确定方向
      if (swipeDirection.current === null) {
        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5) {
          swipeDirection.current = 'horizontal';
        } else if (Math.abs(dy) > 5) {
          swipeDirection.current = 'vertical';
        }
      }

      if (swipeDirection.current !== 'horizontal') return;

      hasSwiped.current = true;

      // 只有左滑（负值）生效
      if (dx > 0 && !isOpen) {
        setTranslateX(0);
        return;
      }

      const maxSlide = actions.length * actionWidth;
      const targetX = isOpen ? -maxSlide + dx : Math.max(dx, -maxSlide);
      setTranslateX(Math.min(targetX, 0));
    },
    [isOpen, actions.length, actionWidth],
  );

  const handleTouchEnd = useCallback(() => {
    isSwiping.current = false;
    swipeDirection.current = null;

    const maxSlide = actions.length * actionWidth;
    if (translateX < -threshold) {
      // 打开操作菜单
      setIsOpen(true);
      setTranslateX(-maxSlide);
    } else {
      // 关闭
      setIsOpen(false);
      setTranslateX(0);
    }

    // 标记本次触摸是否发生了有效滑动（在下一个 click 中消费后重置）
  }, [translateX, threshold, actions.length, actionWidth]);

  const close = useCallback(() => {
    setIsOpen(false);
    setTranslateX(0);
  }, []);

  // 滑动后阻止 click 冒泡；单击已打开的菜单则关闭（不穿透到子元素）
  const handleWrapperClick = useCallback((e: React.MouseEvent) => {
    if (hasSwiped.current) {
      e.stopPropagation();
      e.preventDefault();
      hasSwiped.current = false;
      // 不 return，继续处理 isOpen 关闭
    }
    if (isOpen) {
      e.stopPropagation();
      close();
    }
  }, [isOpen, close]);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* 背景操作按钮 */}
      <div className="absolute inset-y-0 right-0 flex">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              action.onAction();
              close();
            }}
            className={`h-full flex items-center justify-center border-l cursor-pointer transition-colors ${colorMap[action.color]}`}
            style={{ width: `${actionWidth}px` }}
          >
            <div className="flex flex-col items-center gap-1">
              {action.icon}
              <span className="text-[9px] font-mono">{action.label}</span>
            </div>
          </button>
        ))}
      </div>

      {/* 前景内容 — onClick 阻止滑动后的误触 */}
      <div
        className="relative bg-surface-container transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleWrapperClick}
      >
        {children}
      </div>
    </div>
  );
}

/** 预设的聊天列表操作按钮 */
export function chatSwipeActions(
  onPin: () => void,
  onDelete: () => void,
  isPinned: boolean,
): SwipeAction[] {
  return [
    {
      label: isPinned ? '取消置顶' : '置顶',
      icon: isPinned ? (
        <PinOff className="w-4 h-4" />
      ) : (
        <Pin className="w-4 h-4" />
      ),
      color: 'pink',
      onAction: onPin,
    },
    {
      label: '删除',
      icon: <Trash2 className="w-4 h-4" />,
      color: 'red',
      onAction: onDelete,
    },
  ];
}
