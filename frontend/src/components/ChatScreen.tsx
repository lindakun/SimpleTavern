import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ScreenId, Character, ChatMessage, SendState } from '../types';
import { Volume2, Send, AlertCircle, ChevronLeft, Search, X, ChevronUp, ChevronDown, Square, Plus, Cpu, RefreshCw } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { MessageBubble } from './MessageBubble';
import { track } from '../utils/analytics';
import { loadChatSettings, saveChatSettings } from '../utils/chatSettings';
import { useChatStore, sessionLoadKey } from '../stores/chatStore';

const EMPTY_MESSAGES: ChatMessage[] = [];
const NEAR_BOTTOM_PX = 120;

interface ChatScreenProps {
  character: Character;
  /** 可选：不传则从 chatStore 按 character.id 订阅 */
  messages?: ChatMessage[];
  onSendMessage: (characterId: string, text: string) => Promise<void>;
  onDeleteMessage?: (characterId: string, msgId: string) => void;
  onNavigate: (screen: ScreenId) => void;
  onGoBack?: () => void;
  sendState?: SendState;
  userHandle?: string;
  onStopGeneration?: () => void;
  onEditMessage?: (characterId: string, messageId: string, newText: string) => void;
  onRegenerateMessage?: (characterId: string, messageId: string) => void;
  onNewChat?: (characterId: string, greetingIndex?: number) => void;
  onLoadOlderMessages?: (characterId: string) => Promise<void>;
  onRetryFailedSend?: (characterId: string) => Promise<void>;
  onContinueGeneration?: (characterId: string) => Promise<void>;
}

export default function ChatScreen({
  character,
  messages: messagesProp,
  onSendMessage,
  onDeleteMessage,
  onNavigate,
  onGoBack,
  sendState: sendStateProp,
  userHandle,
  onStopGeneration,
  onEditMessage,
  onRegenerateMessage,
  onNewChat,
  onLoadOlderMessages,
  onRetryFailedSend,
  onContinueGeneration,
}: ChatScreenProps) {
  // 细粒度订阅：仅当前角色消息 / 发送态 / 分页，不经 App 透传
  const storeMessages = useChatStore(
    (s) => s.chatThreads[character.id]?.messages ?? EMPTY_MESSAGES,
  );
  const storeSendState = useChatStore(
    (s) => s.sendingStates[character.id] || 'idle',
  );
  const historyPage = useChatStore((s) => {
    const key = sessionLoadKey(character.id, s.activeChatFiles[character.id] || 'chat');
    return s.historyPage[key] ?? s.historyPage[character.id];
  });

  const messages = messagesProp ?? storeMessages;
  const sendState = sendStateProp ?? storeSendState;

  const [inputText, setInputText] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);

  const lastMsg = messages[messages.length - 1];
  const isStreaming = sendState === 'streaming' || (lastMsg?.role === 'model' && lastMsg?.text === '');
  const isSending = sendState === 'sending';
  const isBusy = isSending || isStreaming;
  const showGreeting = messages.length === 0;
  const hasMoreOlder = Boolean(historyPage?.hasMore);
  const loadingOlder = Boolean(historyPage?.loadingOlder);

  // 首 token 等待提示
  const [waitHint, setWaitHint] = useState<string | null>(null);
  useEffect(() => {
    if (sendState !== 'sending') {
      setWaitHint(null);
      return;
    }
    const t1 = setTimeout(() => setWaitHint('模型思考中…'), 3000);
    const t2 = setTimeout(() => setWaitHint('首字较慢：若选了「本地」模型，建议切换到「推荐·云端」'), 10000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [sendState]);

  // 模型选择
  const [providers, setProviders] = useState<Array<{ id: string; name: string; model?: string; isLocal?: boolean }>>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(loadChatSettings().providerId);
  const [showModelMenu, setShowModelMenu] = useState(false);
  useEffect(() => {
    fetch('/api/chat/providers', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const list: Array<{ id: string; name: string; model?: string; isLocal?: boolean }> =
          Array.isArray(data?.providers) ? data.providers : [];
        list.sort((a, b) => Number(a.isLocal) - Number(b.isLocal));
        setProviders(list);
        if (!loadChatSettings().providerId && data?.active) {
          setActiveProvider(data.active);
        }
      })
      .catch(() => {});
  }, []);

  // ── 虚拟滚动数据 ──
  const allItems = useMemo(() => {
    const items: Array<
      | { type: 'load-older' }
      | { type: 'greeting' }
      | { type: 'message'; msg: ChatMessage; idx: number }
      | { type: 'streaming' }
    > = [];
    if (hasMoreOlder || loadingOlder) {
      items.push({ type: 'load-older' as const });
    }
    if (showGreeting) {
      items.push({ type: 'greeting' as const });
    }
    messages.forEach((msg, idx) => {
      const isLastEmptyAi = idx === messages.length - 1 && msg.role === 'model' && !msg.text;
      if (!isLastEmptyAi) {
        items.push({ type: 'message' as const, msg, idx });
      }
    });
    if (isSending || (isStreaming && (!lastMsg?.text || lastMsg.role !== 'model'))) {
      items.push({ type: 'streaming' as const });
    }
    return items;
  }, [messages, isStreaming, isSending, showGreeting, lastMsg?.text, lastMsg?.role, hasMoreOlder, loadingOlder]);

  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 15,
  });

  const scrollToIndexRef = useRef(virtualizer.scrollToIndex);
  scrollToIndexRef.current = virtualizer.scrollToIndex;

  // 智能贴底：跟踪用户是否在底部附近
  const updateStickFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distance < NEAR_BOTTOM_PX;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateStickFromScroll, { passive: true });
    return () => el.removeEventListener('scroll', updateStickFromScroll);
  }, [updateStickFromScroll]);

  // 上拉加载更早消息
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadOlderMessages || !hasMoreOlder) return;

    const onScroll = () => {
      if (el.scrollTop < 80 && !loadingOlder) {
        const prevHeight = el.scrollHeight;
        void onLoadOlderMessages(character.id).then(() => {
          // 保持视口位置，避免跳动
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              const delta = scrollRef.current.scrollHeight - prevHeight;
              scrollRef.current.scrollTop += delta;
            }
          });
        });
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [onLoadOlderMessages, hasMoreOlder, loadingOlder, character.id]);

  // 初次挂载滚到底
  useEffect(() => {
    if (messages.length === 0) return;
    stickToBottomRef.current = true;
    const timer = setTimeout(() => {
      scrollToIndexRef.current(allItems.length - 1, { align: 'end' });
    }, 200);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 新消息 / 流式：仅在贴底时 stick
  const prevMessageLenRef = useRef(messages.length);
  const prevLastTextLenRef = useRef(lastMsg?.text?.length || 0);
  useEffect(() => {
    if (allItems.length === 0) return;
    const isNewMsg = messages.length > prevMessageLenRef.current;
    const isStreamUpdate = Boolean(lastMsg?.text && lastMsg.text.length > prevLastTextLenRef.current);
    prevMessageLenRef.current = messages.length;
    prevLastTextLenRef.current = lastMsg?.text?.length || 0;

    // 用户刚发送 → 强制贴底
    if (isNewMsg && lastMsg?.role === 'user') {
      stickToBottomRef.current = true;
    }

    if ((isNewMsg || isStreamUpdate) && stickToBottomRef.current) {
      requestAnimationFrame(() => {
        scrollToIndexRef.current(allItems.length - 1, { align: 'end' });
      });
    }
  }, [messages, lastMsg?.text, lastMsg?.role, allItems.length]);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [inputText]);

  const searchMatchIndices = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    messages.forEach((msg, idx) => {
      if (msg.text.toLowerCase().includes(q)) indices.push(idx);
    });
    return indices;
  }, [searchQuery, messages]);

  const matchSet = useMemo(() => new Set(searchMatchIndices), [searchMatchIndices]);

  useEffect(() => {
    if (!showSearch || searchMatchIndices.length === 0) return;
    const msgIdx = searchMatchIndices[currentMatchIndex];
    if (msgIdx === undefined) return;
    const loadOffset = (hasMoreOlder || loadingOlder) ? 1 : 0;
    const virtualIndex = loadOffset + (showGreeting ? 1 : 0) + msgIdx;
    if (virtualIndex < allItems.length) {
      virtualizer.scrollToIndex(virtualIndex, { align: 'center', behavior: 'smooth' });
    }
  }, [currentMatchIndex, showSearch, showGreeting, hasMoreOlder, loadingOlder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showSearch]);

  const searchPrev = useCallback(() => {
    setCurrentMatchIndex((prev) => (prev > 0 ? prev - 1 : searchMatchIndices.length - 1));
  }, [searchMatchIndices.length]);

  const searchNext = useCallback(() => {
    setCurrentMatchIndex((prev) => (prev < searchMatchIndices.length - 1 ? prev + 1 : 0));
  }, [searchMatchIndices.length]);

  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded-sm px-0.5">{part}</mark>
        : part,
    );
  }, []);

  useEffect(() => {
    const handleVisualViewport = () => {
      if (document.activeElement === inputRef.current && window.visualViewport) {
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };
    window.visualViewport?.addEventListener('resize', handleVisualViewport);
    return () => window.visualViewport?.removeEventListener('resize', handleVisualViewport);
  }, []);

  // 发送失败时自动填 lastError（store 里 error 气泡）
  useEffect(() => {
    if (sendState === 'error' && lastMsg?.role === 'model' && /发送失败/.test(lastMsg.text || '')) {
      const m = lastMsg.text.match(/发送失败[：:]\s*(.+)）?$/);
      if (m) setLastError(m[1]?.replace(/）$/, '') || '消息发送失败');
    }
    if (sendState === 'idle' || sendState === 'streaming' || sendState === 'sending') {
      if (sendState !== 'idle' || !lastMsg || !/发送失败/.test(lastMsg.text || '')) {
        // 开始新发送时清错误
        if (sendState === 'sending') {
          setLastError(null);
          setFailedText(null);
        }
      }
    }
  }, [sendState, lastMsg]);

  const handleSend = async (e?: React.FormEvent, retryText?: string) => {
    if (e) e.preventDefault();
    const textToSend = retryText ?? inputText;
    if (!textToSend.trim() || isBusy) return;

    stickToBottomRef.current = true;
    if (!retryText) setInputText('');
    setLastError(null);
    setFailedText(null);

    try {
      await onSendMessage(character.id, textToSend);
      track('send_message', { character_id: character.id, message_length: textToSend.length });
    } catch (err) {
      const message = err instanceof Error ? err.message : '消息发送失败';
      setLastError(message);
      setFailedText(textToSend);
    }
  };

  const handleRetry = useCallback(async () => {
    setLastError(null);
    setFailedText(null);
    if (onRetryFailedSend) {
      try {
        await onRetryFailedSend(character.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : '重试失败';
        setLastError(message);
      }
      return;
    }
    if (failedText) {
      await handleSend(undefined, failedText);
    }
  }, [onRetryFailedSend, character.id, failedText]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopyMessage = useCallback(async (text: string, msgId: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 1500);
    setActiveMenuId(null);
  }, []);

  const handleRegenerateMessage = useCallback((msgId: string) => {
    setActiveMenuId(null);
    if (onRegenerateMessage) {
      stickToBottomRef.current = true;
      onRegenerateMessage(character.id, msgId);
      return;
    }
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx <= 0) return;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        setTimeout(() => handleSend(undefined, messages[i].text), 50);
        return;
      }
    }
  }, [messages, onRegenerateMessage, character.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartEdit = useCallback((msgId: string, text: string) => {
    setEditingMessageId(msgId);
    setEditText(text);
    setActiveMenuId(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMessageId || !editText.trim()) return;
    stickToBottomRef.current = true;
    onEditMessage?.(character.id, editingMessageId, editText.trim());
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, character.id, onEditMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  const handleDeleteMessage = useCallback((msgId: string) => {
    onDeleteMessage?.(character.id, msgId);
    setActiveMenuId(null);
  }, [character.id, onDeleteMessage]);

  useEffect(() => {
    if (!activeMenuId) return;
    const timer = setTimeout(() => {
      document.addEventListener('click', () => setActiveMenuId(null), { once: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeMenuId]);

  const handleMessageContextMenu = useCallback((e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveMenuId((prev) => (prev === msgId ? null : msgId));
  }, []);

  const handleMessageLongPress = useCallback((msgId: string) => {
    setActiveMenuId((prev) => (prev === msgId ? null : msgId));
  }, []);

  const canShowRetry = Boolean(
    lastError
    || failedText
    || sendState === 'error'
    || (lastMsg?.role === 'model' && /发送失败/.test(lastMsg.text || '')),
  );

  return (
    <div className="relative h-full w-full max-w-lg mx-auto bg-background-deep text-white flex flex-col overflow-hidden">
      <div className="absolute top-1/6 -left-20 w-72 h-72 bg-accent-pink/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/6 -right-20 w-72 h-72 bg-accent-purple/5 rounded-full blur-[100px] pointer-events-none" />

      <header className="app-header flex-shrink-0 z-40 bg-[#0F111A]/95 backdrop-blur-md px-4 flex items-center justify-between border-b border-white/5">
        <button
          type="button"
          onClick={() => (onGoBack ? onGoBack() : onNavigate(ScreenId.MESSAGE_CENTER))}
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

        <button
          type="button"
          onClick={() => onNavigate(ScreenId.CHARACTER_DETAIL)}
          className="flex items-center gap-2 px-3 py-1 bg-surface-elevated/40 border border-outline-variant/20 hover:border-accent-pink/40 rounded-full transition-all cursor-pointer text-left"
        >
          <LazyImage
            src={character.avatar}
            alt={character.name}
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-full object-cover border border-accent-pink/50 flex-shrink-0"
          />
          <div>
            <h1 className="text-xs font-bold text-white tracking-wide truncate max-w-[120px] leading-tight">
              {character.name}
            </h1>
            <span className="text-[9px] text-[#ffade2] tracking-widest font-mono">
              {character.voiceType === 'sweet' ? '甜美少女' : '成熟御姐'}
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5 relative">
          {onNewChat && (
            <button
              type="button"
              onClick={() => {
                if (messages.length > 0 && !window.confirm('将创建新会话，旧对话仍会保留在消息中心，确定吗？')) return;
                const greets = [character.first_mes, ...(character.alternate_greetings || [])].filter(Boolean);
                const idx = greets.length > 1 ? Math.floor(Math.random() * greets.length) : 0;
                onNewChat(character.id, greets.length ? idx : undefined);
              }}
              className="p-1.5 rounded-full hover:bg-white/5 text-on-surface-variant/60 hover:text-accent-pink transition-colors"
              title="新建会话"
              disabled={isBusy}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowModelMenu((v) => !v)}
            className="p-1.5 rounded-full hover:bg-white/5 text-on-surface-variant/60 hover:text-cyan-400 transition-colors"
            title="切换模型"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowSearch(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            className="p-1.5 rounded-full hover:bg-white/5 text-on-surface-variant/60 hover:text-accent-pink transition-colors"
            title="搜索聊天记录 (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          {showModelMenu && providers.length > 0 && (
            <div className="absolute right-0 top-9 z-50 w-56 max-h-64 overflow-y-auto bg-[#1A1625] border border-outline-variant/40 rounded-xl shadow-2xl p-1.5">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setActiveProvider(p.id);
                    saveChatSettings({ providerId: p.id });
                    setShowModelMenu(false);
                    track('select_provider', { provider_id: p.id });
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-[11px] transition-colors ${
                    activeProvider === p.id
                      ? 'bg-accent-pink/15 text-accent-pink'
                      : 'text-on-surface-variant hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-[9px] opacity-70 truncate font-mono">
                    {p.isLocal ? '较慢·本地 · ' : '推荐·云端 · '}{p.model || p.id}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => onNavigate(ScreenId.SETTINGS)}
                className="w-full text-left px-2.5 py-2 mt-1 rounded-lg text-[10px] text-on-surface-variant/70 hover:text-white border-t border-white/5"
              >
                更多生成设置 →
              </button>
            </div>
          )}
        </div>
      </header>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0 z-30 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2 bg-surface-container/95 border-b border-accent-pink/20 backdrop-blur-md">
              <Search className="w-3.5 h-3.5 text-accent-pink flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.shiftKey ? searchPrev() : searchNext();
                  }
                  if (e.key === 'Escape') {
                    setShowSearch(false);
                    setSearchQuery('');
                  }
                }}
                placeholder="搜索聊天记录..."
                className="flex-1 bg-transparent text-xs text-white focus:outline-none placeholder:text-on-surface-variant/40"
              />
              {searchQuery && (
                <span className="text-[10px] text-on-surface-variant/60 font-mono flex-shrink-0">
                  {searchMatchIndices.length > 0
                    ? `${currentMatchIndex + 1}/${searchMatchIndices.length}`
                    : '无结果'}
                </span>
              )}
              {searchMatchIndices.length > 0 && (
                <>
                  <button type="button" onClick={searchPrev} className="p-1 rounded hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors flex-shrink-0" title="上一个">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={searchNext} className="p-1 rounded hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors flex-shrink-0" title="下一个">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                }}
                className="p-1 rounded hover:bg-white/10 text-on-surface-variant/60 hover:text-white transition-colors flex-shrink-0"
                title="关闭"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 select-text scrollbar-thin scrollable-touch"
        style={{ contain: 'strict' }}
      >
        <div
          className="relative w-full"
          style={{
            height: `${Math.max(virtualizer.getTotalSize(), 1)}px`,
            minHeight: '100%',
          }}
        >
          {virtualizer.getTotalSize() > 0 && (
            <div
              style={{
                paddingTop: `${Math.max(0, (scrollRef.current?.clientHeight || 0) - virtualizer.getTotalSize())}px`,
              }}
            />
          )}
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = allItems[virtualItem.index];
            if (!item) return null;

            if (item.type === 'load-older') {
              return (
                <div
                  key="load-older"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute top-0 left-0 right-0 py-3 flex justify-center"
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <button
                    type="button"
                    disabled={loadingOlder}
                    onClick={() => onLoadOlderMessages?.(character.id)}
                    className="text-[10px] text-on-surface-variant/70 hover:text-accent-pink px-3 py-1 rounded-full border border-outline-variant/20 hover:border-accent-pink/30 disabled:opacity-50"
                  >
                    {loadingOlder ? '加载中…' : '加载更早消息'}
                  </button>
                </div>
              );
            }

            if (item.type === 'greeting') {
              return (
                <div
                  key="greeting"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute top-0 left-0 right-0 py-3"
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <div className="flex items-start gap-2.5">
                    <LazyImage
                      alt={character.name}
                      src={character.avatar}
                      className="w-8 h-8 rounded-full object-cover border border-outline-variant/40 flex-shrink-0"
                    />
                    <div className="bg-surface-container/60 border border-outline-variant/20 p-3.5 rounded-2xl rounded-tl-none max-w-[80%] backdrop-blur-md">
                      <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                        {(() => {
                          const template = character.first_mes || character.tagline || `同步成功！我是 ${character.name}。\n赛博深处与你链接，开始发问吧。`;
                          return template
                            .replace(/\{\{char\}\}/g, character.name)
                            .replace(/\{\{user\}\}/g, userHandle || '你');
                        })()}
                      </p>
                      <span className="text-[8px] text-on-surface-variant/40 font-mono mt-1 block">柚姬协议连接正常</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type === 'streaming') {
              return (
                <div
                  key="streaming"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute top-0 left-0 right-0 py-3"
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <div className="flex items-start gap-2.5">
                    <LazyImage alt={character.name} src={character.avatar} className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" />
                    <div className="bg-surface-container/60 border border-outline-variant/20 px-4 py-3 rounded-2xl rounded-tl-none space-y-1.5">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      {waitHint && (
                        <p className="text-[10px] text-on-surface-variant/60 font-mono">{waitHint}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (item.type !== 'message') return null;
            const { msg, idx } = item;
            const isLast = idx === messages.length - 1;
            // 流式最后一条 AI：纯文本
            const plainText = Boolean(
              isBusy && isLast && msg.role === 'model',
            );

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className="absolute top-0 left-0 right-0 py-3"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <MessageBubble
                  msg={msg}
                  idx={idx}
                  isLast={isLast}
                  characterName={character.name}
                  characterAvatar={character.avatar}
                  userHandle={userHandle}
                  plainText={plainText}
                  isBusy={isBusy}
                  isSearchHit={showSearch && matchSet.has(idx)}
                  isCurrentSearchHit={idx === searchMatchIndices[currentMatchIndex]}
                  searchQuery={showSearch ? searchQuery : ''}
                  highlightText={highlightText}
                  editingMessageId={editingMessageId}
                  editText={editText}
                  editInputRef={editInputRef}
                  activeMenuId={activeMenuId}
                  copiedId={copiedId}
                  onContextMenu={handleMessageContextMenu}
                  onLongPress={handleMessageLongPress}
                  onCopy={handleCopyMessage}
                  onStartEdit={handleStartEdit}
                  onConfirmEdit={handleConfirmEdit}
                  onCancelEdit={handleCancelEdit}
                  onEditTextChange={setEditText}
                  onRegenerate={onRegenerateMessage ? handleRegenerateMessage : undefined}
                  onDelete={handleDeleteMessage}
                  longPressTimerRef={longPressTimerRef}
                />
                {msg.role !== 'user' && isLast && !isBusy && (
                  <div className="flex justify-start pl-10 mt-1 gap-2 flex-wrap">
                    {msg.truncated && onContinueGeneration && (
                      <button
                        type="button"
                        onClick={() => {
                          stickToBottomRef.current = true;
                          void onContinueGeneration(character.id);
                        }}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-cyan-300/90 hover:text-cyan-200 hover:bg-cyan-400/10 border border-cyan-400/20 transition-colors"
                        title="模型输出被截断，继续生成"
                      >
                        续写
                      </button>
                    )}
                    {onRegenerateMessage && (
                      <button
                        type="button"
                        onClick={() => handleRegenerateMessage(msg.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-on-surface-variant/60 hover:text-amber-300 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20 transition-colors"
                        title="重新生成"
                      >
                        <RefreshCw className="w-3 h-3" />
                        重新生成
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <div className="app-bottom-bar flex-shrink-0 w-full bg-[#0B0720]/95 border-t border-outline-variant/20 p-3 flex flex-col gap-2">
        <form onSubmit={(e) => handleSend(e)} className="w-full flex items-center gap-2 p-1.5 bg-surface-container/80 rounded-xl border border-outline-variant/40 backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                return;
              }
              const lastAiMsg = [...messages].reverse().find((m) => m.role === 'model' && m.text.trim());
              if (lastAiMsg) {
                const utter = new SpeechSynthesisUtterance(lastAiMsg.text);
                utter.lang = 'zh-CN';
                utter.rate = 1.0;
                utter.onend = () => setIsSpeaking(false);
                utter.onerror = () => setIsSpeaking(false);
                utteranceRef.current = utter;
                setIsSpeaking(true);
                window.speechSynthesis.speak(utter);
              }
            }}
            className={`p-1.5 rounded-lg cursor-pointer flex-shrink-0 flex items-center justify-center transition-colors ${
              isSpeaking ? 'text-red-400 bg-red-500/10 animate-pulse' : 'text-accent-pink hover:bg-accent-pink/10'
            }`}
            title={isSpeaking ? '停止朗读' : '配音朗读'}
          >
            <Volume2 className="w-4 h-4" />
          </button>

          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`给 ${character.name} 发送秘密信号...`}
            rows={1}
            className="flex-grow bg-transparent text-base text-white focus:outline-none placeholder:text-on-surface-variant/40 resize-none leading-relaxed py-1.5 overflow-y-auto"
          />
          <button
            type="submit"
            disabled={!isBusy && !inputText.trim() && !canShowRetry}
            onClick={(e) => {
              if (isBusy) {
                e.preventDefault();
                onStopGeneration?.();
                return;
              }
              if (canShowRetry && !inputText.trim()) {
                e.preventDefault();
                void handleRetry();
              }
            }}
            className={`p-2 w-8 h-8 shrink-0 rounded-lg transition-all flex items-center justify-center ${
              isBusy
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : canShowRetry && !inputText.trim()
                  ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                  : 'bg-gradient-to-r from-accent-pink to-accent-purple text-white hover:brightness-110'
            } active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isBusy ? '停止生成' : canShowRetry && !inputText.trim() ? '重试' : '发送'}
          >
            {isBusy ? (
              <Square className="w-3.5 h-3.5" />
            ) : canShowRetry && !inputText.trim() ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>

        {(lastError || canShowRetry) && !isBusy && (
          <div className="text-[10px] text-red-400 flex items-center gap-2 px-2">
            <span className="flex-1">{lastError || '上一条消息发送失败'}</span>
            <button
              type="button"
              onClick={() => handleRetry()}
              className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-[10px] text-red-300 hover:bg-red-500/30 cursor-pointer"
            >
              重试
            </button>
          </div>
        )}

        {isSending && !lastError && (
          <div className="text-[10px] text-accent-pink/60 font-mono text-center animate-pulse">
            正在连接神经矩阵...
          </div>
        )}
        {sendState === 'streaming' && !lastError && (
          <div className="text-[10px] text-[#ffade2]/60 font-mono text-center">
            AI 正在生成回复...
          </div>
        )}
      </div>

      <BottomNav currentScreen={ScreenId.CHAT} onNavigate={onNavigate} inline />
    </div>
  );
}
