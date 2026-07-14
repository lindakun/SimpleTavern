import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ScreenId, Character, ChatMessage, SendState } from '../types';
import { Volume2, Send, AlertCircle, ChevronLeft, Copy, Trash2, RefreshCw, Check, Search, X, ChevronUp, ChevronDown, Square, Pencil, Plus, Cpu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { track } from '../utils/analytics';
import { formatChatDate } from '../utils/formatDate';
import { loadChatSettings, saveChatSettings } from '../utils/chatSettings';

interface ChatScreenProps {
  character: Character;
  messages: ChatMessage[];
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
}

export default function ChatScreen({
  character,
  messages,
  onSendMessage,
  onDeleteMessage,
  onNavigate,
  onGoBack,
  sendState = 'idle',
  userHandle,
  onStopGeneration,
  onEditMessage,
  onRegenerateMessage,
  onNewChat,
}: ChatScreenProps) {
  const [inputText, setInputText] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 消息操作菜单状态
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 搜索状态
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 消息编辑状态
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // 判断 AI 是否正在流式回复
  const lastMsg = messages[messages.length - 1];
  const isStreaming = sendState === 'streaming' || (lastMsg?.role === 'model' && lastMsg?.text === '');
  const isSending = sendState === 'sending';
  // 有真实对话记录时不再单独叠一层 first_mes 开场白（避免重复）
  const showGreeting = messages.length === 0;

  // 首 token 等待提示：sending 超过 3s 仍无内容
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

  // 模型选择（轻量，本地持久化）
  const [providers, setProviders] = useState<Array<{ id: string; name: string; model?: string; isLocal?: boolean }>>([]);
  const [activeProvider, setActiveProvider] = useState<string | null>(loadChatSettings().providerId);
  const [showModelMenu, setShowModelMenu] = useState(false);
  useEffect(() => {
    fetch('/api/chat/providers', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const list: Array<{ id: string; name: string; model?: string; isLocal?: boolean }> =
          Array.isArray(data?.providers) ? data.providers : [];
        // 云端排前，便于发现「推荐」模型
        list.sort((a, b) => Number(a.isLocal) - Number(b.isLocal));
        setProviders(list);
        // 无用户偏好时跟随服务端 active（默认可为本地 llm_4）
        if (!loadChatSettings().providerId && data?.active) {
          setActiveProvider(data.active);
        }
      })
      .catch(() => {});
  }, []);

  // ── 虚拟滚动：Greeting（仅空会话）+ Messages + StreamingIndicator ──
  const allItems = useMemo(() => {
    const items: Array<{ type: 'greeting' } | { type: 'message'; msg: ChatMessage; idx: number } | { type: 'streaming' }> = [];
    if (showGreeting) {
      items.push({ type: 'greeting' as const });
    }
    messages.forEach((msg, idx) => {
      const isLastEmptyAi = idx === messages.length - 1 && msg.role === 'model' && !msg.text;
      if (!isLastEmptyAi) {
        items.push({ type: 'message' as const, msg, idx });
      }
    });
    // 仅在尚未出字时显示 typing；已有流式文本时只更新气泡，避免双指示器
    if (isSending || (isStreaming && (!lastMsg?.text || lastMsg.role !== 'model'))) {
      items.push({ type: 'streaming' as const });
    }
    return items;
  }, [messages, isStreaming, isSending, showGreeting, lastMsg?.text, lastMsg?.role]);

  // ── 虚拟滚动实例 ──
  const virtualizer = useVirtualizer({
    count: allItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 120,
    overscan: 15,
  });

  // Auto-scroll to bottom: on mount (with pre-loaded messages) AND on new messages/streaming
  const scrollToIndexRef = useRef(virtualizer.scrollToIndex);
  scrollToIndexRef.current = virtualizer.scrollToIndex;
  // Scroll on mount when messages are already loaded (e.g. re-opening chat)
  useEffect(() => {
    if (messages.length === 0) return;
    const timer = setTimeout(() => {
      scrollToIndexRef.current(allItems.length - 1, { align: 'end' });
    }, 200);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — only on mount
  // Scroll when new messages arrive or streaming updates
  const prevMessageLenRef = useRef(messages.length);
  const prevLastTextLenRef = useRef(lastMsg?.text?.length || 0);
  useEffect(() => {
    if (allItems.length === 0) return;
    const isNewMsg = messages.length > prevMessageLenRef.current;
    const isStreamUpdate = lastMsg?.text && lastMsg.text.length > prevLastTextLenRef.current;
    prevMessageLenRef.current = messages.length;
    prevLastTextLenRef.current = lastMsg?.text?.length || 0;
    if (isNewMsg || isStreamUpdate) {
      setTimeout(() => {
        scrollToIndexRef.current(allItems.length - 1, { align: 'end' });
      }, 100);
    }
  }, [messages, lastMsg?.text, allItems.length]);

  // 键盘回避：当输入框聚焦时，确保它在可视区域内
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 输入框自动调整高度
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [inputText]);

  // ── 搜索：计算匹配的消息索引列表 ──
  const searchMatchIndices = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    messages.forEach((msg, idx) => {
      if (msg.text.toLowerCase().includes(q)) {
        indices.push(idx);
      }
    });
    return indices;
  }, [searchQuery, messages]);

  // ── 搜索：匹配索引 Set（O(1) 查找，替代 includes(idx)） ──
  const matchSet = React.useMemo(() => new Set(searchMatchIndices), [searchMatchIndices]);

  // ── 搜索：滚动到当前匹配消息 ──
  useEffect(() => {
    if (!showSearch || searchMatchIndices.length === 0) return;
    const msgIdx = searchMatchIndices[currentMatchIndex];
    if (msgIdx === undefined) return;
    // greeting 仅在空会话时占 index 0
    const virtualIndex = showGreeting ? msgIdx + 1 : msgIdx;
    if (virtualIndex < allItems.length) {
      virtualizer.scrollToIndex(virtualIndex, { align: 'center', behavior: 'smooth' });
    }
  }, [currentMatchIndex, showSearch, showGreeting]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 键盘快捷键：Ctrl+F 打开搜索 ──
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

  // ── 搜索：上/下导航 ──
  const searchPrev = useCallback(() => {
    setCurrentMatchIndex(prev =>
      prev > 0 ? prev - 1 : searchMatchIndices.length - 1,
    );
  }, [searchMatchIndices.length]);

  const searchNext = useCallback(() => {
    setCurrentMatchIndex(prev =>
      prev < searchMatchIndices.length - 1 ? prev + 1 : 0,
    );
  }, [searchMatchIndices.length]);

  // ── 文本高亮组件 ──
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
        // 在移动端键盘弹出时，输入框应该可见
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    };

    window.visualViewport?.addEventListener('resize', handleVisualViewport);
    return () => window.visualViewport?.removeEventListener('resize', handleVisualViewport);
  }, []);

  const handleSend = async (e?: React.FormEvent, retryText?: string) => {
    if (e) e.preventDefault();
    const textToSend = retryText ?? inputText;
    // 阻止重复发送：如果正在发送或流式接收中
    if (!textToSend.trim() || isStreaming || isSending) return;

    setInputText('');
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

  // ── 消息操作：复制 ──
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

  // ── 消息操作：重新生成（走专用 API，不污染历史）──
  const handleRegenerateMessage = useCallback((msgId: string) => {
    setActiveMenuId(null);
    if (onRegenerateMessage) {
      onRegenerateMessage(character.id, msgId);
      return;
    }
    // 降级：旧行为（不推荐）
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx <= 0) return;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        setTimeout(() => handleSend(undefined, messages[i].text), 50);
        return;
      }
    }
  }, [messages, onRegenerateMessage, character.id]);

  // ── 消息操作：编辑 ──
  const handleStartEdit = useCallback((msgId: string, text: string) => {
    setEditingMessageId(msgId);
    setEditText(text);
    setActiveMenuId(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }, []);

  const handleConfirmEdit = useCallback(() => {
    if (!editingMessageId || !editText.trim()) return;
    onEditMessage?.(character.id, editingMessageId, editText.trim());
    setEditingMessageId(null);
    setEditText('');
  }, [editingMessageId, editText, character.id, onEditMessage]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageId(null);
    setEditText('');
  }, []);

  // ── 消息操作：删除 ──
  const handleDeleteMessage = useCallback((msgId: string) => {
    if (onDeleteMessage) {
      onDeleteMessage(character.id, msgId);
    }
    setActiveMenuId(null);
  }, [character.id, onDeleteMessage]);

  // ── 全局点击关闭操作菜单 ──
  useEffect(() => {
    if (!activeMenuId) return;
    const timer = setTimeout(() => {
      document.addEventListener('click', () => setActiveMenuId(null), { once: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [activeMenuId]);

  // ── 右键 / 长按打开操作菜单 ──
  const handleMessageContextMenu = useCallback(
    (e: React.MouseEvent, msgId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveMenuId(prev => prev === msgId ? null : msgId);
    },
    [],
  );

  const handleMessageLongPress = useCallback(
    (msgId: string) => {
      setActiveMenuId(prev => prev === msgId ? null : msgId);
    },
    [],
  );

  return (
    <div className="relative h-full w-full max-w-lg mx-auto bg-background-deep text-white flex flex-col overflow-hidden">
      {/* Glow */}
      <div className="absolute top-1/6 -left-20 w-72 h-72 bg-accent-pink/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/6 -right-20 w-72 h-72 bg-accent-purple/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header bar - wrapping image in clickable button to satisfy validation xpath: //header//img/.. */}
      <header className="flex-shrink-0 z-40 bg-[#0F111A]/95 backdrop-blur-md h-16 px-4 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => onGoBack ? onGoBack() : onNavigate(ScreenId.MESSAGE_CENTER)}
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

        {/* Clickable Avatar Header block -> triggers CHAT_DETAIL screen (push transition) */}
        <button
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
              onClick={() => {
                if (messages.length > 0 && !window.confirm('开始新对话将清空当前会话记录，确定吗？')) return;
                // 若有 alternate_greetings，随机选一个开场写入消息
                const greets = [character.first_mes, ...(character.alternate_greetings || [])].filter(Boolean);
                const idx = greets.length > 1 ? Math.floor(Math.random() * greets.length) : 0;
                onNewChat(character.id, greets.length ? idx : undefined);
              }}
              className="p-1.5 rounded-full hover:bg-white/5 text-on-surface-variant/60 hover:text-accent-pink transition-colors"
              title="新对话"
              disabled={isStreaming || isSending}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => setShowModelMenu((v) => !v)}
            className="p-1.5 rounded-full hover:bg-white/5 text-on-surface-variant/60 hover:text-cyan-400 transition-colors"
            title="切换模型"
          >
            <Cpu className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
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
                onClick={() => onNavigate(ScreenId.SETTINGS)}
                className="w-full text-left px-2.5 py-2 mt-1 rounded-lg text-[10px] text-on-surface-variant/70 hover:text-white border-t border-white/5"
              >
                更多生成设置 →
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── 搜索工具栏 ── */}
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
                  <button
                    onClick={searchPrev}
                    className="p-1 rounded hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors flex-shrink-0"
                    title="上一个 (Shift+Enter)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={searchNext}
                    className="p-1 rounded hover:bg-white/10 text-on-surface-variant hover:text-white transition-colors flex-shrink-0"
                    title="下一个 (Enter)"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                className="p-1 rounded hover:bg-white/10 text-on-surface-variant/60 hover:text-white transition-colors flex-shrink-0"
                title="关闭搜索 (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Scroll Area — 虚拟滚动 */}
      <main ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 select-text scrollbar-thin scrollable-touch" style={{ contain: 'strict' }}>
        <div
          className="relative w-full"
          style={{
            height: `${Math.max(virtualizer.getTotalSize(), 1)}px`,
            minHeight: '100%',
          }}
        >
          {/* Push-to-bottom: when total content is shorter than viewport, push to bottom */}
          {virtualizer.getTotalSize() > 0 && (
            <div style={{
              paddingTop: `${Math.max(0, (scrollRef.current?.clientHeight || 0) - virtualizer.getTotalSize())}px`,
            }} />
          )}
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = allItems[virtualItem.index];
            if (!item) return null;
            const isGreeting = item.type === 'greeting';
            const isStreamingItem = item.type === 'streaming';

            if (isGreeting) {
              return (
                <div
                  key="greeting"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                className="absolute top-0 left-0 right-0 py-3"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <div className="flex items-start gap-2.5 animate-subtle-fadeIn">
                    <LazyImage
                      alt={character.name}
                      src={character.avatar}
                      className="w-8 h-8 rounded-full object-cover border border-outline-variant/40 flex-shrink-0"
                    />
                    <div className="bg-surface-container/60 border border-outline-variant/20 p-3.5 rounded-2xl rounded-tl-none max-w-[80%] backdrop-blur-md">
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {(() => {
                          const template = character.first_mes || character.tagline || `同步成功！我是 ${character.name}。\n赛博深处与你链接，开始发问吧。`;
                          const greetText = template
                            .replace(/\{\{char\}\}/g, character.name)
                            .replace(/\{\{user\}\}/g, userHandle || '你');
                          return greetText.split('\n').map((line, i) => (
                            <React.Fragment key={i}>{i > 0 && <br />}{line}</React.Fragment>
                          ));
                        })()}
                      </p>
                      <span className="text-[8px] text-on-surface-variant/40 font-mono mt-1 block">柚姬协议连接正常</span>
                    </div>
                  </div>
                </div>
              );
            }

            if (isStreamingItem) {
              return (
                <div
                  key="streaming"
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  className="absolute top-0 left-0 right-0 py-3"
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5"
                  >
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
                  </motion.div>
                </div>
              );
            }

            // Regular message item
            if (item.type !== 'message') return null;
            const { msg, idx } = item;
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className="absolute top-0 left-0 right-0 py-3"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''} ${
                    showSearch && matchSet.has(idx)
                      ? idx === searchMatchIndices[currentMatchIndex]
                        ? 'ring-2 ring-yellow-400/50 rounded-2xl'
                        : ''
                      : ''
                  }`}
                  onContextMenu={(e) => handleMessageContextMenu(e, msg.id)}
                  onTouchStart={() => {
                    longPressTimerRef.current = setTimeout(() => handleMessageLongPress(msg.id), 500);
                  }}
                  onTouchEnd={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                  onTouchMove={() => {
                    if (longPressTimerRef.current) {
                      clearTimeout(longPressTimerRef.current);
                      longPressTimerRef.current = null;
                    }
                  }}
                >
                  {/* Profile Bubble */}
                  {!isUser && (
                    <img
                      alt={character.name}
                      src={character.avatar}
                      className="w-8 h-8 rounded-full object-cover border border-outline-variant/40 flex-shrink-0"
                    />
                  )}
                  {isUser && (() => {
                    const initials = (userHandle ?? 'ME').slice(0, 2).toUpperCase();
                    const hash = (userHandle ?? 'ME').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
                    const hue = hash % 360;
                    return (
                      <div
                        className="w-8 h-8 rounded-full uppercase font-bold text-[10px] flex items-center justify-center border font-mono flex-shrink-0"
                        style={{
                          backgroundColor: `hsl(${hue}, 60%, 25%)`,
                          color: `hsl(${hue}, 70%, 80%)`,
                          borderColor: `hsl(${hue}, 50%, 50%)`,
                        }}
                      >
                        {initials}
                      </div>
                    );
                  })()}

                  {/* Text Dialogue Bubble */}
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] border backdrop-blur-md relative cursor-context-menu ${
                      isUser
                        ? 'bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border-accent-pink/40 text-white rounded-tr-none'
                        : 'bg-surface-container/80 border-outline-variant/10 text-[#e3e1ee] rounded-tl-none shadow-md'
                    }`}
                  >
                    {/* 消息内容 — 编辑模式 */}
                    {editingMessageId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          ref={editInputRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmEdit(); }
                            if (e.key === 'Escape') { handleCancelEdit(); }
                          }}
                          rows={3}
                          className="w-full bg-surface-elevated/80 border border-accent-pink/40 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink resize-none"
                        />
                        <div className="flex gap-2">
                          <button onClick={handleConfirmEdit} className="px-3 py-1 bg-accent-pink/20 border border-accent-pink/40 rounded text-[10px] text-accent-pink hover:bg-accent-pink/30 cursor-pointer">确认</button>
                          <button onClick={handleCancelEdit} className="px-3 py-1 bg-surface-elevated/60 border border-outline-variant/30 rounded text-[10px] text-on-surface-variant hover:text-white cursor-pointer">取消</button>
                        </div>
                      </div>
                    ) : (
                      isUser ? (
                        <p className="whitespace-pre-wrap select-text">{showSearch ? highlightText(msg.text, searchQuery) : msg.text}</p>
                      ) : showSearch ? (
                        <p className="whitespace-pre-wrap select-text">{highlightText(msg.text, searchQuery)}</p>
                      ) : (
                        <div className="markdown-body select-text">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                        </div>
                      )
                    )}
                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5 text-on-surface-variant/30 font-mono">
                      <span className="text-[8px] text-on-surface-variant/40 cursor-default" title={new Date(msg.timestamp).toLocaleString()}>
                        {formatChatDate(msg.timestamp)}
                      </span>
                      {!isUser && (
                        <div className="flex items-end gap-[2px] h-3 px-1.5 py-0.5 rounded-md bg-accent-pink/5 border border-accent-pink/15 shadow-[0_0_8px_rgba(236,72,153,0.15)] overflow-hidden" title="Voice waveform">
                          <span className="w-[1.5px] h-2 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-one" />
                          <span className="w-[1.5px] h-3.5 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-two" />
                          <span className="w-[1.5px] h-1.5 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-three" />
                          <span className="w-[1.5px] h-2.5 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-two" />
                          <span className="w-[1.5px] h-1 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-one" />
                        </div>
                      )}
                    </div>

                    {/* 操作菜单按钮（右键/长按后显示） */}
                    <AnimatePresence>
                      {activeMenuId === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85, y: 4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.85, y: 4 }}
                          transition={{ duration: 0.15 }}
                          className={`absolute z-50 flex items-center gap-1 bg-[#1A1625] border border-outline-variant/40 rounded-xl px-2 py-1.5 shadow-2xl backdrop-blur-xl ${
                            isUser ? 'right-0 -bottom-9' : 'left-0 -bottom-9'
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleCopyMessage(msg.text, msg.id)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-white"
                            title="复制"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-green-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {isUser && (
                            <button
                              onClick={() => handleStartEdit(msg.id, msg.text)}
                              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-cyan-400"
                              title="编辑"
                              disabled={isStreaming || isSending}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!isUser && (
                            <button
                              onClick={() => handleRegenerateMessage(msg.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-amber-400"
                              title="重新生成"
                              disabled={isStreaming || isSending}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-red-400"
                            title="删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
                {/* 最新 AI 消息快捷重新生成 */}
                {!isUser && idx === messages.length - 1 && !isStreaming && !isSending && onRegenerateMessage && (
                  <div className="flex justify-start pl-10 mt-1">
                    <button
                      onClick={() => handleRegenerateMessage(msg.id)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-on-surface-variant/60 hover:text-amber-300 hover:bg-amber-400/10 border border-transparent hover:border-amber-400/20 transition-colors"
                      title="重新生成"
                    >
                      <RefreshCw className="w-3 h-3" />
                      重新生成
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Input controls */}
      <div className="flex-shrink-0 w-full bg-[#0B0720]/95 border-t border-outline-variant/20 p-3 flex items-center gap-2">
        <form onSubmit={(e) => handleSend(e)} className="w-full flex items-center gap-2 p-1.5 bg-surface-container/80 rounded-xl border border-outline-variant/40 backdrop-blur-md">
          {/* Voice TTS - Web Speech API */}
          <button
            type="button"
            onClick={() => {
              if (isSpeaking) {
                window.speechSynthesis.cancel();
                setIsSpeaking(false);
                return;
              }
              // Read last AI message
              const lastAiMsg = [...messages].reverse().find(m => m.role === 'model' && m.text.trim());
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
            disabled={(!inputText.trim() && !isStreaming) || isSending}
            onClick={(e) => {
              if (isStreaming || isSending) {
                e.preventDefault();
                onStopGeneration?.();
                return;
              }
            }}
            className={`p-2 w-8 h-8 shrink-0 rounded-lg transition-all flex items-center justify-center ${
              isStreaming
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : sendState === 'error'
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : 'bg-gradient-to-r from-accent-pink to-accent-purple text-white hover:brightness-110'
            } active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              isStreaming ? '停止生成' :
              sendState === 'sending' ? '发送中...' :
              sendState === 'error' ? '重试' :
              '发送'
            }
          >
            {isStreaming || isSending ? (
              <Square className="w-3.5 h-3.5" />
            ) : sendState === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
        {lastError && (
          <div className="mt-2 text-[10px] text-red-400 flex items-center gap-2 px-2">
            <span className="flex-1">{lastError}</span>
            {failedText && (
              <button
                onClick={() => handleSend(undefined, failedText)}
                className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 rounded text-[10px] text-red-300 hover:bg-red-500/30 cursor-pointer"
              >
                重试
              </button>
            )}
          </div>
        )}
        {/* 发送状态提示 */}
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
