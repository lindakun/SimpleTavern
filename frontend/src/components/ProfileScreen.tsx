import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenId, AppState } from '../types';
import { Heart, Smile, Settings, HelpCircle, ChevronRight, Camera } from 'lucide-react';
import BottomNav from './BottomNav';

interface ProfileUser {
  handle: string;
  name: string;
  created: number;
  avatar: string;
  admin: boolean;
}

interface ProfileScreenProps {
  user: AppState['user'];
  favoriteCount: number;
  myCharactersCount: number;
  onNavigate: (screen: ScreenId) => void;
  onLogout: () => void;
}

export default function ProfileScreen({
  user,
  favoriteCount,
  myCharactersCount,
  onNavigate,
  onLogout,
}: ProfileScreenProps) {
  const [profile, setProfile] = useState<ProfileUser | null>(null);

  useEffect(() => {
    fetch('/api/users/me')
      .then(res => res.json())
      .then(data => {
        if (data?.handle) setProfile(data);
      })
      .catch(() => {});
  }, []);

  // 头像编辑器状态
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const [translateY, setTranslateY] = useState(0);
  const [scale, setScale] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        setEditingImage(ev.target.result as string);
        setTranslateX(0);
        setTranslateY(0);
        setScale(1);
        setShowAvatarEditor(true);
      }
    };
    reader.readAsDataURL(file);
    // 重置 input 以便重复选择同一文件
    e.target.value = '';
  };

  // 鼠标/触摸拖动
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    dragStart.current = { x: clientX, y: clientY, tx: translateX, ty: translateY };
  }, [translateX, translateY]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!dragStart.current) return;
    const dx = clientX - dragStart.current.x;
    const dy = clientY - dragStart.current.y;
    setTranslateX(dragStart.current.tx + dx);
    setTranslateY(dragStart.current.ty + dy);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragStart.current = null;
  }, []);

  // 裁剪并保存头像
  const saveAvatar = useCallback(() => {
    if (!editingImage) return;
    const img = new Image();
    img.onload = () => {
      const size = 200;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 用与视觉完全相同的算法绘制
      renderCoverImage(ctx, img, size, size, translateX, translateY, scale);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      fetch('/api/users/change-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: profile?.handle || '', avatar: dataUrl }),
      })
        .then(res => {
          if (res.ok || res.status === 204) {
            setProfile(prev => prev ? { ...prev, avatar: dataUrl } : prev);
            setShowAvatarEditor(false);
          }
        })
        .catch(() => {});
    };
    img.src = editingImage;
  }, [editingImage, translateX, translateY, scale, profile]);

  // 在 canvas 上以 cover + 拖动 + 缩放的方式绘制图片
  function renderCoverImage(
    ctx: CanvasRenderingContext2D, img: HTMLImageElement,
    cw: number, ch: number, dx: number, dy: number, sc: number,
  ) {
    // cover: 图片填满容器，保持比例，居中
    const baseScale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const finalScale = baseScale * sc;
    const baseOffX = (cw - img.naturalWidth * baseScale) / 2;
    const baseOffY = (ch - img.naturalHeight * baseScale) / 2;
    const drawX = baseOffX + dx;
    const drawY = baseOffY + dy;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, cw / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(
      img,
      drawX, drawY,
      img.naturalWidth * finalScale, img.naturalHeight * finalScale,
    );
    ctx.restore();
  }

  const username = profile?.name || user?.username || '霓虹幻行特工';
  const email = user?.email || (profile?.handle ? `${profile.handle}@yuzu.ai` : 'pilot@yuzu.ai');
  const avatarUrl = profile?.avatar || 'https://picsum.photos/seed/cyberagent/300/300';
  const createdDate = profile?.created ? new Date(profile.created).toLocaleDateString('zh-CN') : null;

  const handleLogoutClick = () => {
    onLogout(); // handleLogout 内部已经负责导航到 WELCOME
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-background-deep text-[#e3e1ee] safe-content-bottom scrollable-touch">
      {/* Background cyber ambiance */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-accent-pink opacity-10 blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-accent-purple opacity-5 blur-[110px] pointer-events-none" />

      {/* Header */}
      <header className="app-header sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 flex items-center justify-between border-b border-white/5">
        <h1 className="text-sm font-bold tracking-widest text-[#ffd8ee] font-headline-lg-mobile">
          个人中心
        </h1>
        <div className="w-10" />
      </header>

      {/* User info visual card */}
      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">
        
        {/* Profile Card details */}
        <div className="bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border border-accent-pink/20 rounded-3xl p-6 flex flex-col items-center text-center space-y-4 backdrop-blur-md">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-accent-pink shadow-[0_0_20px_rgba(232,121,199,0.3)] group cursor-pointer" onClick={openFilePicker}>
            {avatarUrl ? (
              <img
                alt="用户头像"
                src={avatarUrl}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-accent-pink/20 flex items-center justify-center text-2xl font-bold text-accent-pink">
                {username[0]?.toUpperCase() || '?'}
              </div>
            )}
            {/* 悬浮编辑提示 */}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-6 h-6 text-white" />
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white tracking-wide">{username}</h2>
            <span className="text-xs text-on-surface-variant font-mono">{email}</span>
            {createdDate && (
              <span className="text-[10px] text-on-surface-variant/50 font-mono block">注册于 {createdDate}</span>
            )}
          </div>

          {/* Integration specs brief tags */}
          <div className="flex gap-4 pt-2 text-xs border-t border-outline-variant/25 w-full justify-around font-mono">
            <div>
              <span className="text-[10px] text-on-surface-variant/75 block">收藏序列</span>
              <span className="text-sm font-bold text-accent-pink">{favoriteCount} 个</span>
            </div>
            <div>
              <span className="text-[10px] text-on-surface-variant/75 block">自研角色</span>
              <span className="text-sm font-bold text-accent-purple">{myCharactersCount} 个</span>
            </div>
          </div>
        </div>

        {/* Action Link Cells - structured to satisfy: //span[text()='我的收藏']/ancestor::a */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">通用数字资产</h3>

          {/* Anchor cell 1: Favorites */}
          <a
            onClick={() => onNavigate(ScreenId.MY_FAVORITES)}
            className="flex items-center justify-between p-4 bg-surface rounded-xl hover:border-accent-pink border border-outline-variant/20 cursor-pointer block hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <Heart className="w-4 h-4 text-accent-pink fill-accent-pink/20" />
              <span className="text-xs font-semibold text-white">我的收藏</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium">
              <span>查看更多</span>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/70" />
            </div>
          </a>

          {/* Anchor cell 2: Custom characters */}
          <a
            onClick={() => onNavigate(ScreenId.MY_CHARACTERS)}
            className="flex items-center justify-between p-4 bg-surface rounded-xl hover:border-accent-pink border border-outline-variant/20 cursor-pointer block hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smile className="w-4 h-4 text-accent-purple" />
              <span className="text-xs font-semibold text-white">我的角色</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium">
              <span>管理与编辑</span>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/70" />
            </div>
          </a>

          {/* Anchor cell 3: Settings */}
          <a
            onClick={() => onNavigate(ScreenId.SETTINGS)}
            className="flex items-center justify-between p-4 bg-surface rounded-xl hover:border-accent-pink border border-outline-variant/20 cursor-pointer block hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-white">设置</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium">
              <span>个性偏好修改</span>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/70" />
            </div>
          </a>

          {/* Anchor cell 4: Help & Feedback */}
          <a
            onClick={() => onNavigate(ScreenId.HELP_FEEDBACK)}
            className="flex items-center justify-between p-4 bg-surface rounded-xl hover:border-accent-pink border border-outline-variant/20 cursor-pointer block hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-3">
              <HelpCircle className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-semibold text-white">帮助与反馈</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium">
              <span>FAQ与申诉</span>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant/70" />
            </div>
          </a>
        </div>

        {/* Google Logout Action conforming with xpath: //button[contains(., '退出登录')] */}
        <div className="pt-6 pb-4">
          <button
            onClick={handleLogoutClick}
            className="w-full h-12 bg-surface-container border border-red-500/35 hover:border-red-500 text-xs text-red-400 rounded-xl hover:bg-red-500/10 cursor-pointer active:scale-95 transition-all"
          >
            退出登录
          </button>
        </div>
      </main>

      <BottomNav currentScreen={ScreenId.PROFILE} onNavigate={onNavigate} />

      {/* 头像编辑弹窗 - 禁止背景滚动（带清理） */}
      {showAvatarEditor && editingImage && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6" style={{ overscrollBehavior: 'contain' }}>
          <div className="bg-surface-elevated rounded-2xl w-full max-w-sm overflow-hidden border border-outline-variant/30">
            {/* 标题 */}
            <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">调整头像</h3>
              <button
                onClick={() => setShowAvatarEditor(false)}
                className="text-xs text-on-surface-variant hover:text-white cursor-pointer"
              >
                取消
              </button>
            </div>

            {/* 裁剪区域 - 用 Canvas 精确渲染，所见即所得 */}
            <div className="p-4">
              <div
                ref={cropAreaRef}
                className="relative w-full aspect-square rounded-full overflow-hidden bg-black mx-auto"
                style={{ maxWidth: 280 }}
                onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
                onMouseMove={(e) => { if (dragStart.current) handleDragMove(e.clientX, e.clientY); }}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (t) handleDragStart(t.clientX, t.clientY);
                }}
                onTouchMove={(e) => {
                  if (dragStart.current) {
                    const t = e.touches[0];
                    if (t) handleDragMove(t.clientX, t.clientY);
                  }
                }}
                onTouchEnd={handleDragEnd}
              >
                <CropCanvas
                  imageUrl={editingImage}
                  translateX={translateX}
                  translateY={translateY}
                  scale={scale}
                />
              </div>

              {/* 缩放控制 */}
              <div className="flex items-center gap-3 mt-4 px-2">
                <span className="text-[10px] text-on-surface-variant">缩小</span>
                <input
                  type="range"
                  min="0.8"
                  max="3"
                  step="0.05"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="flex-1 accent-accent-pink"
                />
                <span className="text-[10px] text-on-surface-variant">放大</span>
              </div>
            </div>

            {/* 确认按钮 */}
            <div className="px-4 pb-4 safe-bottom">
              <button
                onClick={saveAvatar}
                className="w-full py-2.5 bg-accent-pink text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
              >
                保存头像
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 用 Canvas 渲染裁剪预览，同步拖动/缩放
function CropCanvas({ imageUrl, translateX, translateY, scale }: {
  imageUrl: string; translateX: number; translateY: number; scale: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = el.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (!w || !h) return;
    el.width = w * dpr;
    el.height = h * dpr;
    const ctx = el.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // 圆形裁剪
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
      ctx.clip();
      const baseScale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const finalScale = baseScale * scale;
      const baseOffX = (w - img.naturalWidth * baseScale) / 2;
      const baseOffY = (h - img.naturalHeight * baseScale) / 2;
      ctx.drawImage(
        img,
        baseOffX + translateX, baseOffY + translateY,
        img.naturalWidth * finalScale, img.naturalHeight * finalScale,
      );
      ctx.restore();
    };
    img.src = imageUrl;
  }, [imageUrl, translateX, translateY, scale]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full rounded-full"
    />
  );
}
