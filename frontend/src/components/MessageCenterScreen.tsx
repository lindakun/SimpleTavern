import { useState, useMemo } from 'react';
import { ScreenId, Character, ChatThread } from '../types';
import { RotateCw, Pin, PinOff, Trash2, X, CheckSquare, Square } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { useToast } from './Toast.tsx';
import { useChatThreads, useBatchDeleteChats, useTogglePinChat, chatKeys } from '../hooks/useChat';
import { useQueryClient } from '@tanstack/react-query';

interface MessageCenterScreenProps {
  characters: Character[];
  chatThreads: Record<string, ChatThread>;
  onNavigate: (screen: ScreenId) => void;
  onSelectCharacter: (id: string) => void;
  onDeleteChatThreads?: (characterIds: string[]) => void;
  onTogglePinChat?: (characterId: string, pinned: boolean) => void;
}

export default function MessageCenterScreen({
  characters,
  chatThreads,
  onNavigate,
  onSelectCharacter,
  onDeleteChatThreads,
  onTogglePinChat,
}: MessageCenterScreenProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const { data: _threadList = [], refetch: refetchThreads } = useChatThreads();
  const batchDelete = useBatchDeleteChats();
  const togglePin = useTogglePinChat();

  // 选择模式状态
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleSync = async () => {
    try {
      await refetchThreads();
      queryClient.invalidateQueries({ queryKey: chatKeys.threads() });
      showToast('已同步最新消息', 'success');
    } catch {
      showToast('同步失败', 'error');
    }
  };

  // 只显示有聊天记录的活跃会话
  const activeChatIds = new Set(Object.keys(chatThreads));
  const chatList = useMemo(() => {
    return characters
      .filter((c) => c.id !== 'ai_broadcast' && activeChatIds.has(c.id))
      .sort((a, b) => {
        const aPinned = chatThreads[a.id]?.pinned ? 1 : 0;
        const bPinned = chatThreads[b.id]?.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        const aTime = chatThreads[a.id]?.updatedAt || '';
        const bTime = chatThreads[b.id]?.updatedAt || '';
        return bTime.localeCompare(aTime);
      });
  }, [characters, chatThreads, activeChatIds]);

  // 选择模式操作
  const enterSelectionMode = (characterId: string) => {
    setIsSelectionMode(true);
    setSelectedIds(new Set([characterId]));
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (characterId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === chatList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(chatList.map(c => c.id)));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;

    const idsToDelete = Array.from(selectedIds);
    try {
      await batchDelete.mutateAsync(idsToDelete);
      // 同步清除本地状态
      if (onDeleteChatThreads) {
        onDeleteChatThreads(idsToDelete);
      }
      exitSelectionMode();
    } catch {
      // error handled by mutation
    }
  };

  // 置顶切换
  const handleTogglePin = async (characterId: string, currentPinned: boolean) => {
    const newPinned = !currentPinned;
    try {
      await togglePin.mutateAsync({ characterId, pinned: newPinned });
      if (onTogglePinChat) {
        onTogglePinChat(characterId, newPinned);
      }
    } catch {
      // error handled by mutation
    }
  };

  // Broadcast term
  const systemBroadcastCharacter = characters.find((c) => c.id === 'ai_broadcast');

  const isAllSelected = chatList.length > 0 && selectedIds.size === chatList.length;

  return (
    <div className="relative min-h-screen bg-background-deep text-white pb-24">
      {/* Heavy colorful glowing neon overlays */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent-pink opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-purple opacity-10 blur-[130px] pointer-events-none" />

      {/* Sticky top-bar search */}
      <header className="sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5">
        <h1 className="text-lg font-bold tracking-widest text-[#ffade2] font-headline-lg-mobile">
          {isSelectionMode ? `已选 ${selectedIds.size} 项` : '消息中心'}
        </h1>
        <div className="flex gap-3 items-center">
          {!isSelectionMode && (
            <button
              onClick={handleSync}
              className="p-2 text-on-surface hover:text-[#ffade2] cursor-pointer flex items-center justify-center"
            >
              <RotateCw className="w-5 h-5 text-accent-pink" />
            </button>
          )}
          {isSelectionMode ? (
            <button
              onClick={exitSelectionMode}
              className="p-2 text-on-surface hover:text-[#ffade2] cursor-pointer flex items-center justify-center"
            >
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>
          ) : (
            chatList.length > 0 && (
              <button
                onClick={() => {
                  setIsSelectionMode(true);
                  setSelectedIds(new Set());
                }}
                className="text-[11px] px-3 py-1.5 rounded-full bg-accent-pink/10 border border-accent-pink/30 text-[#ffade2] hover:bg-accent-pink/20 transition-colors cursor-pointer"
              >
                管理
              </button>
            )
          )}
        </div>
      </header>

      {/* Main Inbox items */}
      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">
        
        {/* System broadcast banner */}
        {systemBroadcastCharacter && !isSelectionMode && (
          <div className="bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border border-accent-pink/20 rounded-2xl p-4 flex gap-4 backdrop-blur-md items-center animate-subtle-fadeIn">
            <div className="w-10 h-10 rounded-xl bg-accent-pink/15 flex items-center justify-center text-accent-pink text-lg font-mono">
              📢
            </div>
            <div className="flex-grow space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#ffade2]">系统广播</span>
                <span className="text-[9px] bg-accent-pink/25 text-[#ffade2] px-2 py-0.2 rounded font-mono">NEW</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                v2.0 赛博朋克主题已上线！快来体验全新的霓虹幻彩角色对话与高频微控世界书吧~
              </p>
            </div>
          </div>
        )}

        {/* 选择模式下的全选栏 */}
        {isSelectionMode && (
          <button
            onClick={toggleSelectAll}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container/40 border border-outline-variant/20 hover:border-accent-pink/30 transition-all"
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-accent-pink" />
            ) : (
              <Square className="w-5 h-5 text-on-surface-variant" />
            )}
            <span className="text-xs text-on-surface-variant">
              {isAllSelected ? '取消全选' : '全选'}
            </span>
          </button>
        )}

        {!isSelectionMode && (
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">最近会话活跃 (Active)</h2>
        )}

        {/* Messaging Box list */}
        <div className="space-y-3">
          {chatList.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-xs">
              暂无聊天记录，去发现页面选择一个角色开始对话吧
            </div>
          ) : chatList.map((c) => {
            const thread = chatThreads[c.id];
            const isPinned = thread?.pinned || false;
            const isSelected = selectedIds.has(c.id);
            
            // Get last message text: prefer thread summary, then latest message, then tagline
            const lastMsgText = thread?.lastMessageText
              ?? (thread?.messages?.length ? thread.messages[thread.messages.length - 1]?.text : null)
              ?? c.tagline
              ?? c.description?.slice(0, 40);

            const unreadCount = thread?.unreadCount || 0;
            
            return (
              <div
                key={c.id}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelect(c.id);
                  } else {
                    onSelectCharacter(c.id);
                    onNavigate(ScreenId.CHAT);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!isSelectionMode) {
                    enterSelectionMode(c.id);
                  }
                }}
                className={`bg-surface-container/40 hover:bg-surface-container border p-4 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? 'border-accent-pink/60 bg-accent-pink/5'
                    : 'border-outline-variant/20 hover:border-accent-pink/30'
                } ${isPinned ? 'border-l-2 border-l-accent-pink/60' : ''}`}
              >
                {/* 选择模式复选框 */}
                {isSelectionMode && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                    className="flex-shrink-0 cursor-pointer"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-accent-pink" />
                    ) : (
                      <Square className="w-5 h-5 text-on-surface-variant" />
                    )}
                  </button>
                )}

                {/* Avatar with unread indicator badge */}
                <div className="relative">
                  <LazyImage
                    src={c.avatar}
                    alt={c.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border border-outline-variant/30"
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent-pink text-white font-bold leading-none w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-background-deep animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                  {c.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border border-background-deep" />
                  )}
                </div>

                {/* Message Body snippet */}
                <div className="flex-grow space-y-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-sm text-white hover:text-accent-pink truncate">
                        {c.id === 'yuki' ? '柚姬' : c.name}
                      </span>
                      {isPinned && !isSelectionMode && (
                        <Pin className="w-3 h-3 text-accent-pink flex-shrink-0" />
                      )}
                    </div>
                    <span className="text-[10px] text-on-surface-variant/40 font-mono flex-shrink-0">
                      {thread?.updatedAt
                        ? new Date(thread.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : (c.lastActiveLabel || '')}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-1">
                    {lastMsgText}
                  </p>
                </div>

                {/* 非选择模式下的操作按钮 */}
                {!isSelectionMode && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleTogglePin(c.id, isPinned); }}
                      className="p-1.5 rounded-lg hover:bg-surface-container/80 transition-colors cursor-pointer"
                      title={isPinned ? '取消置顶' : '置顶'}
                    >
                      {isPinned ? (
                        <PinOff className="w-4 h-4 text-accent-pink" />
                      ) : (
                        <Pin className="w-4 h-4 text-on-surface-variant/40 hover:text-accent-pink" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* 批量操作底栏 */}
      {isSelectionMode && (
        <div className="fixed bottom-16 left-0 right-0 z-50 max-w-lg mx-auto">
          <div className="bg-[#0F111A]/95 backdrop-blur-md border-t border-accent-pink/20 px-6 py-3 flex items-center justify-between">
            <button
              onClick={exitSelectionMode}
              className="text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer px-3 py-2"
            >
              取消
            </button>
            <button
              onClick={handleBatchDelete}
              disabled={selectedIds.size === 0 || batchDelete.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs font-semibold"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {batchDelete.isPending ? '删除中...' : `删除 (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Global Fixed Navigation Bar */}
      <BottomNav currentScreen={ScreenId.MESSAGE_CENTER} onNavigate={onNavigate} />
    </div>
  );
}
