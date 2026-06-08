import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, Character, ChatMessage, SendState } from '../types';
import { Volume2, Send, Loader2, AlertCircle, ChevronLeft, Copy, Trash2, RefreshCw, Check, Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { track } from '../utils/analytics';
import { formatChatDate } from '../utils/formatDate';

interface ChatScreenProps {
  character: Character;
  messages: ChatMessage[];
  onSendMessage: (characterId: string, text: string) => Promise<void>;
  onDeleteMessage?: (characterId: string, msgId: string) => void;
  onNavigate: (screen: ScreenId) => void;
  onGoBack?: () => void;
  sendState?: SendState;
}

export default function ChatScreen({
  character,
  messages,
  onSendMessage,
  onDeleteMessage,
  onNavigate,
  onGoBack,
  sendState = 'idle',
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

  // 判断 AI 是否正在流式回复：最后一条是 AI 消息但内容为空 或 sendState 为 streaming/sending
  const lastMsg = messages[messages.length - 1];
  const isStreaming = sendState === 'streaming' || (lastMsg?.role === 'model' && lastMsg?.text === '');
  const isSending = sendState === 'sending';

  // Auto-scroll when messages update or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

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
    const idx = searchMatchIndices[currentMatchIndex];
    if (idx === undefined) return;
    const el = document.getElementById(`msg-${messages[idx]?.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatchIndex, showSearch]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── 消息操作：重新生成 ──
  const handleRegenerateMessage = useCallback((msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx <= 0) { setActiveMenuId(null); return; }
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        setActiveMenuId(null);
        setTimeout(() => handleSend(undefined, messages[i].text), 50);
        return;
      }
    }
    setActiveMenuId(null);
  }, [messages]);

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
            className="p-1.5 rounded-full hover:bg-white/5 text-on-surface-variant/60 hover:text-accent-pink transition-colors"
            title="搜索聊天记录 (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold text-green-400 tracking-widest">ONLINE</span>
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

      {/* Messages Scroll Area */}
      <main ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-6 flex flex-col justify-end gap-4 select-text scrollbar-thin scrollable-touch">
        {/* Default Greeting */}
        <div className="flex items-start gap-2.5 animate-subtle-fadeIn">
          <LazyImage
            alt={character.name}
            src={character.avatar}
            className="w-8 h-8 rounded-full object-cover border border-outline-variant/40 flex-shrink-0"
          />
          <div className="bg-surface-container/60 border border-outline-variant/20 p-3.5 rounded-2xl rounded-tl-none max-w-[80%] backdrop-blur-md">
            <p className="text-xs text-on-surface-variant leading-relaxed">
              同步成功！我是 {character.name}。<br />
              {character.tagline || '赛博深处与你链接，开始发问吧。'}
            </p>
            <span className="text-[8px] text-on-surface-variant/40 font-mono mt-1 block">Yuzu Protocol Connection OK</span>
          </div>
        </div>

        {/* Render chat history — 流式加载时跳过最后一条空 AI 占位消息，由下方加载动画替代 */}
        {messages.map((msg, idx) => {
          const isLastEmptyAi = idx === messages.length - 1 && msg.role === 'model' && !msg.text;
          if (isLastEmptyAi) return null;
          const isUser = msg.role === 'user';
          return (
            <motion.div
              key={msg.id}
              id={`msg-${msg.id}`}
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
              {isUser && (
                <div className="w-8 h-8 rounded-full bg-accent-pink/20 uppercase font-bold text-accent-pink text-[10px] flex items-center justify-center border border-accent-pink/40 font-mono flex-shrink-0">
                  PT
                </div>
              )}

              {/* Text Dialogue Bubble */}
              <div
                className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] border backdrop-blur-md relative cursor-context-menu ${
                  isUser
                    ? 'bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border-accent-pink/40 text-white rounded-tr-none'
                    : 'bg-surface-container/80 border-outline-variant/10 text-[#e3e1ee] rounded-tl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap select-text">{showSearch ? highlightText(msg.text, searchQuery) : msg.text}</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5 text-on-surface-variant/30 font-mono">
                  <span className="text-[8px] text-on-surface-variant/40">{formatChatDate(msg.timestamp)}</span>
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
          );
        })}

        {/* 流式接收中加载动画 */}
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5"
          >
            <LazyImage alt={character.name} src={character.avatar} className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" />
            <div className="bg-surface-container/60 border border-outline-variant/20 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Input controls */}
      <div className="flex-shrink-0 w-full bg-[#0B0720]/95 border-t border-outline-variant/20 p-3 flex items-center gap-2">
        <form onSubmit={(e) => handleSend(e)} className="w-full flex items-center gap-2 p-1.5 bg-surface-container/80 rounded-xl border border-outline-variant/40 backdrop-blur-md">
          {/* Quick voice option simulation */}
          <button
            type="button"
            onClick={() => {
              const audioObj = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');
              audioObj.volume = 0.2;
              audioObj.play().catch(() => {});
              alert(`（🔊 正在为您播放 ${character.name} 特属声音音频序列……）`);
            }}
            className="p-1.5 text-accent-pink hover:bg-accent-pink/10 rounded-lg cursor-pointer flex-shrink-0 flex items-center justify-center"
            title="配音朗读"
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
            disabled={!inputText.trim() || isStreaming || isSending}
            className={`p-2 w-8 h-8 shrink-0 rounded-lg transition-all flex items-center justify-center ${
              sendState === 'error'
                ? 'bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30'
                : 'bg-gradient-to-r from-accent-pink to-accent-purple text-white hover:brightness-110'
            } active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed`}
            title={
              sendState === 'sending' ? '发送中...' :
              sendState === 'streaming' ? 'AI 回复中...' :
              sendState === 'error' ? '重试' :
              '发送'
            }
          >
            {sendState === 'sending' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : sendState === 'streaming' ? (
              <span className="flex gap-[2px]">
                <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1 h-1 rounded-full bg-white animate-bounce" style={{ animationDelay: '240ms' }} />
              </span>
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
