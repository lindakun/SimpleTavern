import { ScreenId, Character } from '../types';
import { Plus, ChevronLeft } from 'lucide-react';
import LazyImage from './LazyImage';

interface MyCharactersScreenProps {
  characters: Character[];
  onNavigate: (screen: ScreenId) => void;
  onSelectCharacter: (id: string) => void;
  onEditCharacter?: (character: Character) => void;
  onDeleteCharacter?: (id: string) => void;
  currentUser?: string;
}

export default function MyCharactersScreen({
  characters,
  onNavigate,
  onSelectCharacter,
  onEditCharacter,
  onDeleteCharacter,
  currentUser,
}: MyCharactersScreenProps) {
  // 显示用户自己的角色：custom_ 前缀（用户发布）+ .png 结尾（用户目录下的 PNG 角色卡）
  const authorCharacters = characters.filter((c) => {
    if (c.id.startsWith('custom_') || c.id.endsWith('.png')) {
      return !currentUser || !c.creator || c.creator === currentUser;
    }
    return false;
  });

  const startChatAction = (id: string) => {
    onSelectCharacter(id);
    onNavigate(ScreenId.CHAT);
  };

  const editCharacterAction = (char: Character) => {
    onEditCharacter?.(char);
    onNavigate(ScreenId.CREATE_CHARACTER);
  };

  const deleteCharacterAction = (char: Character) => {
    if (window.confirm(`确认删除角色「${char.name}」？此操作不可恢复。`)) {
      onDeleteCharacter?.(char.id);
    }
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-background-deep text-[#e3e1ee] safe-content-bottom">
      {/* Neon ambiance */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-accent-pink opacity-10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Header with arrow_back */}
      <header className="sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => onNavigate(ScreenId.PROFILE)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">返回</span>
        </button>
        <span className="font-bold text-sm tracking-widest text-[#ffd8ee] font-headline-lg-mobile">
          我的角色
        </span>
        <button
          onClick={() => onNavigate(ScreenId.CREATE_CHOICE)}
          className="p-2 text-accent-pink hover:text-white cursor-pointer flex items-center justify-center"
          title="新增部署"
        >
          <Plus className="w-5 h-5" />
        </button>
      </header>

      {/* Main characters inventory */}
      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">
        
        {/* Search input placeholder */}
        <div className="relative">
          <input
            type="text"
            placeholder="搜索我的角色..."
            className="w-full bg-surface-container/60 border border-outline-variant/30 rounded-xl py-2 px-4 text-xs text-white"
            disabled
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-xs">🔍</span>
        </div>

        {/* Character List block */}
        <div className="space-y-4">
          {authorCharacters.length === 0 ? (
            <div className="py-12 bg-surface-container/30 border border-outline-variant/20 rounded-2xl text-center text-on-surface-variant">
              暂无已发布的自研角色，点击右上角 “+” 或点击下方卡片立即新建！
            </div>
          ) : (
            authorCharacters.map((c) => {
              const isDraft = c.status === 'draft';
              const isPrivate = c.status === 'private';

              return (
                <div
                  key={c.id}
                  className="bg-surface-container border border-outline-variant/25 p-4 rounded-2xl space-y-4"
                >
                  <div className="flex items-start gap-4">
                    <LazyImage
                      src={c.avatar}
                      alt={c.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border border-outline-variant/30"
                    />
                    <div className="flex-grow space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-white">{c.name}</h3>
                          
                          {/* Online status indicator */}
                          {c.status === 'online' && (
                            <span className="px-2 py-0.5 text-[8px] bg-green-500/10 text-green-400 border border-green-500/30 rounded font-mono uppercase font-bold">
                              ONLINE
                            </span>
                          )}
                          {isPrivate && (
                            <span className="px-2 py-0.5 text-[8px] bg-accent-purple/10 text-accent-purple border border-accent-purple/30 rounded font-mono uppercase font-bold">
                              PRIVATE
                            </span>
                          )}
                          {isDraft && (
                            <span className="px-2 py-0.5 text-[8px] bg-neutral-500/10 text-gray-400 border border-neutral-500/30 rounded font-mono uppercase font-bold">
                              DRAFT
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-on-surface-variant line-clamp-1">{c.tagline || c.description?.slice(0, 40)}</p>
                      <span className="text-[9px] text-on-surface-variant/40 font-mono block">
                        最后活跃: {c.lastActiveLabel || '2小时前'}
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar matching: //button[text()='编辑'] & //button[text()='对话'] */}
                  <div className="flex gap-3 pt-2 border-t border-outline-variant/15 justify-end">
                    {/* Draft case action trigger */}
                    {isDraft ? (
                      <button
                        onClick={() => editCharacterAction(c)}
                        className="px-4 py-2 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl active:scale-95 transition-all text-center w-full cursor-pointer"
                      >
                        继续编辑
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => editCharacterAction(c)}
                          className="px-4 py-1.5 bg-surface-elevated/80 border border-outline-variant/40 text-xs text-on-surface hover:text-accent-pink rounded-xl cursor-pointer"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => deleteCharacterAction(c)}
                          className="px-4 py-1.5 bg-surface-elevated/80 border border-red-500/30 text-xs text-red-400 hover:border-red-500 rounded-xl cursor-pointer"
                        >
                          删除
                        </button>
                        <button
                          onClick={() => startChatAction(c.id)}
                          className="px-5 py-1.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl cursor-pointer active:scale-95 transition-all"
                        >
                          对话
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom create dashed item matching xpath: //div[text()='创建新角色' or contains(., '创建新角色')] */}
        <div
          onClick={() => onNavigate(ScreenId.CREATE_CHOICE)}
          className="border-2 border-dashed border-accent-pink/30 hover:border-accent-pink rounded-2xl py-6 p-4 flex items-center justify-center gap-2 cursor-pointer hover:bg-accent-pink/5 transition-all"
        >
          <span className="text-accent-pink text-sm font-bold font-mono">⚡</span>
          <span className="text-xs font-bold text-accent-pink">创建新角色</span>
        </div>
      </main>
    </div>
  );
}
