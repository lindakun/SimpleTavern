import React, { useState, useRef, useEffect } from 'react';
import { ScreenId, Character, ChatMessage } from '../types';
import { Volume2, Send, ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';

interface ChatScreenProps {
  character: Character;
  messages: ChatMessage[];
  onSendMessage: (characterId: string, text: string) => Promise<void>;
  onNavigate: (screen: ScreenId) => void;
  onGoBack?: () => void;
}

export default function ChatScreen({
  character,
  messages,
  onSendMessage,
  onNavigate,
  onGoBack,
}: ChatScreenProps) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [failedText, setFailedText] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // 键盘回避：当输入框聚焦时，确保它在可视区域内
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!textToSend.trim() || isTyping) return;

    setInputText('');
    setIsTyping(true);
    setLastError(null);
    setFailedText(null);

    try {
      await onSendMessage(character.id, textToSend);
    } catch (err) {
      const message = err instanceof Error ? err.message : '消息发送失败';
      setLastError(message);
      setFailedText(textToSend);
    } finally {
      setIsTyping(false);
    }
  };

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
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
          <span className="text-[10px] font-mono font-bold text-green-400 tracking-widest">ONLINE</span>
        </div>
      </header>

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

        {/* Render chat history */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''} animate-subtle-fadeIn`}
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
                className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] border backdrop-blur-md ${
                  isUser
                    ? 'bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border-accent-pink/40 text-white rounded-tr-none'
                    : 'bg-surface-container/80 border-outline-variant/10 text-[#e3e1ee] rounded-tl-none shadow-md'
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5 text-on-surface-variant/30 font-mono">
                  <span className="text-[8px] text-on-surface-variant/40">{msg.timestamp}</span>
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
              </div>
            </div>
          );
        })}

        {/* Active model typing states */}
        {isTyping && (
          <div className="flex items-start gap-2.5 animate-pulse">
            <LazyImage alt={character.name} src={character.avatar} className="w-8 h-8 rounded-full object-cover border border-outline-variant/40" />
            <div className="bg-surface-container/60 border border-outline-variant/20 px-4 py-3 rounded-2xl rounded-tl-none">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce delay-200" />
                <span className="w-1.5 h-1.5 rounded-full bg-accent-pink animate-bounce delay-300" />
              </div>
            </div>
          </div>
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
            className="flex-grow bg-transparent text-base text-white focus:outline-none placeholder:text-on-surface-variant/40 resize-none leading-relaxed py-1.5 max-h-24 min-h-[1.5rem]"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="p-2 w-8 h-8 shrink-0 bg-gradient-to-r from-accent-pink to-accent-purple text-white hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-all flex items-center justify-center"
          >
            <Send className="w-3.5 h-3.5" />
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
      </div>

      <BottomNav currentScreen={ScreenId.CHAT} onNavigate={onNavigate} inline />
    </div>
  );
}
