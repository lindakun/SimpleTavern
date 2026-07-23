import { useState, useMemo, useRef, useEffect } from 'react';
import { ScreenId, Character, ChatThread } from '../types';
import { RotateCw, Pin, Trash2, X, CheckSquare, Square } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import SwipeableRow, { chatSwipeActions } from './SwipeableRow';
import { useToast } from './Toast.tsx';
import { useChatThreads, useBatchDeleteChats, useTogglePinChat, chatKeys } from '../hooks/useChat';
import { useChatApi } from '../api/chat';
import { useQueryClient } from '@tanstack/react-query';
import { formatChatDate } from '../utils/formatDate';
import { useChatStore } from '../stores/chatStore';

interface ThreadItem {
  characterId: string;
  chatFile: string;
  characterName: string;
  avatar: string;
  lastMessageText: string;
  lastActive: string;
  messageCount: number;
  pinned: boolean;
  character?: Character;
  /** 列表唯一键：角色 + 会话文件 */
  sessionKey: string;
}

interface MessageCenterScreenProps {
  characters: Character[];
  /** @deprecated 优先从 chatStore 订阅，避免 App 透传导致无关重渲染 */
  chatThreads?: Record<string, ChatThread>;
  onNavigate: (screen: ScreenId) => void;
  /** chatFile 存在时打开对应多会话 */
  onSelectCharacter: (id: string, chatFile?: string) => void;
  onDeleteChatThreads?: (characterIds: string[]) => void;
  onTogglePinChat?: (characterId: string, pinned: boolean) => void;
}

function findCharacter(characters: Character[], characterId: string): Character | undefined {
  return characters.find(c => {
    const cid = c.id.replace(/\.png$/, '');
    return cid === characterId;
  });
}

// ─── 辅助子组件 ───

function AvatarSection({ item }: { item: ThreadItem }) {
  return (
    <div className="relative flex-shrink-0">
      {item.avatar ? (
        <LazyImage
          src={item.avatar}
          alt={item.characterName}
          referrerPolicy="no-referrer"
          className="w-12 h-12 rounded-full object-cover border border-outline-variant/30"
        />
      ) : (
        <div className="w-12 h-12 rounded-full bg-accent-pink/20 flex items-center justify-center text-accent-pink font-bold text-sm border border-outline-variant/30">
          {item.characterName.charAt(0)}
        </div>
      )}
      {item.character?.status === 'online' && (
        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border border-background-deep" />
      )}
    </div>
  );
}



function MessageBody({
  item,
  isSelectionMode,
}: {
  item: ThreadItem;
  isSelectionMode?: boolean;
}) {
  const lastActiveDateStr = formatChatDate(item.lastActive);
  const sessionLabel = item.chatFile && item.chatFile !== 'chat'
    ? item.chatFile.replace(/^chat_/, '会话 ')
    : null;

  return (
    <div className="flex-grow space-y-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-bold text-sm text-white hover:text-accent-pink truncate">
            {item.characterName}
          </span>
          {sessionLabel && (
            <span className="text-[9px] text-cyan-300/70 font-mono flex-shrink-0 truncate max-w-[72px]">
              {sessionLabel}
            </span>
          )}
          {item.pinned && !isSelectionMode && (
            <Pin className="w-3 h-3 text-accent-pink flex-shrink-0" />
          )}
        </div>
        <span className="text-[10px] text-on-surface-variant/40 font-mono flex-shrink-0">
          {lastActiveDateStr}
        </span>
      </div>
      <p className="text-xs text-on-surface-variant line-clamp-1">
        {item.lastMessageText || item.character?.tagline || item.character?.description?.slice(0, 40)}
      </p>
    </div>
  );
}

// ─── 主组件 ───

export default function MessageCenterScreen({
  characters,
  chatThreads: chatThreadsProp,
  onNavigate,
  onSelectCharacter,
  onDeleteChatThreads,
  onTogglePinChat,
}: MessageCenterScreenProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const storeThreads = useChatStore((s) => s.chatThreads);
  const chatThreads = chatThreadsProp ?? storeThreads;
  const { data: threadList = [], refetch: refetchThreads, isPending: threadsLoading } = useChatThreads();
  const batchDelete = useBatchDeleteChats();
  const togglePin = useTogglePinChat();
  const chatApi = useChatApi();
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => clearTimeout(longPressTimer.current);
  }, []);

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

  const chatList = useMemo<ThreadItem[]>(() => {
    return threadList.map((thread) => {
      const character = findCharacter(characters, thread.characterId);
      const chatFile = thread.chatFile || 'chat';
      const localThread = chatThreads[thread.characterId]
        ?? chatThreads[thread.characterId + '.png'];
      // 仅当本地活跃会话文件匹配时，用本地 lastMessage 覆盖（流式中即时预览）
      const localActiveFile = localThread?.chatFile || 'chat';
      const useLocalPreview = localActiveFile === chatFile;
      return {
        characterId: thread.characterId,
        chatFile,
        sessionKey: `${thread.characterId}::${chatFile}`,
        characterName: thread.characterName || character?.name || thread.characterId,
        avatar: character?.avatar || '',
        lastMessageText:
          (useLocalPreview ? localThread?.lastMessageText : undefined)
          || thread.lastMessageText
          || '',
        lastActive: thread.lastActive || '',
        messageCount: thread.messageCount || 0,
        pinned: thread.pinned || false,
        character,
      };
    });
  }, [threadList, characters, chatThreads]);

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
      if (next.has(characterId)) next.delete(characterId);
      else next.add(characterId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === chatList.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(chatList.map(t => t.characterId)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsToDelete = Array.from(selectedIds);
    try {
      await batchDelete.mutateAsync(idsToDelete);
      if (onDeleteChatThreads) onDeleteChatThreads(idsToDelete);
      exitSelectionMode();
    } catch { /* handled by mutation */ }
  };

  // 左滑删除单条会话（仅删该 chatFile，不删角色其它会话）
  const handleDeleteSingle = async (characterId: string, chatFile: string) => {
    try {
      await chatApi.deleteChat(characterId, chatFile || 'chat');
      await refetchThreads();
      queryClient.invalidateQueries({ queryKey: chatKeys.threads() });
      showToast('已删除会话', 'success');
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const handleTogglePin = async (characterId: string, currentPinned: boolean) => {
    const newPinned = !currentPinned;
    try {
      await togglePin.mutateAsync({ characterId, pinned: newPinned });
      if (onTogglePinChat) onTogglePinChat(characterId, newPinned);
    } catch { /* handled by mutation */ }
  };

  const systemBroadcastCharacter = characters.find((c) => c.id === 'ai_broadcast');
  const isAllSelected = chatList.length > 0 && selectedIds.size === chatList.length;

  return (
    <div className="relative flex-1 overflow-y-auto bg-background-deep text-white safe-content-bottom">
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent-pink opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-purple opacity-10 blur-[130px] pointer-events-none" />

      <header className="app-header sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 flex items-center justify-between border-b border-white/5">
        <h1 className="text-lg font-bold tracking-widest text-[#ffade2] font-headline-lg-mobile">
          {isSelectionMode ? `已选 ${selectedIds.size} 项` : '消息中心'}
        </h1>
        <div className="flex gap-3 items-center">
          {!isSelectionMode && (
            <button onClick={handleSync} className="p-2 text-on-surface hover:text-[#ffade2] cursor-pointer flex items-center justify-center">
              <RotateCw className="w-5 h-5 text-accent-pink" />
            </button>
          )}
          {isSelectionMode ? (
            <button onClick={exitSelectionMode} className="p-2 text-on-surface hover:text-[#ffade2] cursor-pointer flex items-center justify-center">
              <X className="w-5 h-5 text-on-surface-variant" />
            </button>
          ) : (
            chatList.length > 0 && (
              <button onClick={() => { setIsSelectionMode(true); setSelectedIds(new Set()); }}
                className="text-[11px] px-3 py-1.5 rounded-full bg-accent-pink/10 border border-accent-pink/30 text-[#ffade2] hover:bg-accent-pink/20 transition-colors cursor-pointer">
                管理
              </button>
            )
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">
        {systemBroadcastCharacter && !isSelectionMode && (
          <div className="bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border border-accent-pink/20 rounded-2xl p-4 flex gap-4 backdrop-blur-md items-center animate-subtle-fadeIn">
            <div className="w-10 h-10 rounded-xl bg-accent-pink/15 flex items-center justify-center text-accent-pink text-lg font-mono">📢</div>
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

        {isSelectionMode && (
          <button onClick={toggleSelectAll}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container/40 border border-outline-variant/20 hover:border-accent-pink/30 transition-all">
            {isAllSelected ? <CheckSquare className="w-5 h-5 text-accent-pink" /> : <Square className="w-5 h-5 text-on-surface-variant" />}
            <span className="text-xs text-on-surface-variant">{isAllSelected ? '取消全选' : '全选'}</span>
          </button>
        )}

        {!isSelectionMode && (
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">最近会话活跃 (Active)</h2>
        )}

        <div className="space-y-3">
          {threadsLoading && chatList.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-xs animate-pulse">
              加载会话列表…
            </div>
          ) : chatList.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-xs">
              暂无聊天记录，去发现页面选择一个角色开始对话吧
            </div>
          ) : chatList.map((item) => {
            const isSelected = selectedIds.has(item.characterId);
            const selectId = item.character?.id || item.characterId;

            const swipeActions = chatSwipeActions(
              () => handleTogglePin(item.characterId, item.pinned),
              () => handleDeleteSingle(item.characterId, item.chatFile),
              item.pinned,
            );

            return isSelectionMode ? (
              <div key={item.sessionKey}
                onClick={() => toggleSelect(item.characterId)}
                className={`flex items-center gap-4 cursor-pointer p-4 rounded-xl border transition-all ${
                  isSelected ? 'border-accent-pink/60 bg-accent-pink/5' : 'border-outline-variant/20 bg-surface-container/40'
                } ${item.pinned ? 'border-l-2 border-l-accent-pink/60' : ''}`}
              >
                <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(item.characterId); }} className="flex-shrink-0 cursor-pointer">
                  {isSelected ? <CheckSquare className="w-5 h-5 text-accent-pink" /> : <Square className="w-5 h-5 text-on-surface-variant" />}
                </button>
                <AvatarSection item={item} />
                <MessageBody item={item} isSelectionMode />
              </div>
            ) : (
              <SwipeableRow key={item.sessionKey} actions={swipeActions}>
                <div
                  onClick={() => {
                    onSelectCharacter(selectId, item.chatFile);
                    onNavigate(ScreenId.CHAT);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); enterSelectionMode(item.characterId); }}
                  onTouchStart={() => {
                    longPressTimer.current = setTimeout(() => enterSelectionMode(item.characterId), 600);
                  }}
                  onTouchEnd={() => clearTimeout(longPressTimer.current)}
                  onTouchMove={() => clearTimeout(longPressTimer.current)}
                  className={`flex items-center gap-4 cursor-pointer p-4 ${
                    item.pinned ? 'border-l-2 border-l-accent-pink/60' : ''
                  }`}
                >
                  <AvatarSection item={item} />
                  <MessageBody item={item} />
                </div>
              </SwipeableRow>
            );
          })}
        </div>
      </main>

      {isSelectionMode && (
        <div className="fixed bottom-above-nav left-0 right-0 z-50 max-w-lg mx-auto">
          <div className="bg-[#0F111A]/95 backdrop-blur-md border-t border-accent-pink/20 px-6 py-3 flex items-center justify-between">
            <button onClick={exitSelectionMode} className="text-xs text-on-surface-variant hover:text-white transition-colors cursor-pointer px-3 py-2">取消</button>
            <button onClick={handleBatchDelete} disabled={selectedIds.size === 0 || batchDelete.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer text-xs font-semibold">
              <Trash2 className="w-3.5 h-3.5" />
              {batchDelete.isPending ? '删除中...' : `删除 (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      <BottomNav currentScreen={ScreenId.MESSAGE_CENTER} onNavigate={onNavigate} />
    </div>
  );
}
