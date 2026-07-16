/**
 * 单条消息气泡（React.memo，流式时旧消息不重渲染）
 */
import React, { memo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import type { ChatMessage } from '../types';
import { formatChatDate } from '../utils/formatDate';

export interface MessageBubbleProps {
  msg: ChatMessage;
  idx: number;
  isLast: boolean;
  characterName: string;
  characterAvatar: string;
  userHandle?: string;
  /** 流式中的最后一条 AI 消息：用纯文本避免 Markdown 反复解析 */
  plainText: boolean;
  isBusy: boolean;
  isSearchHit: boolean;
  isCurrentSearchHit: boolean;
  searchQuery: string;
  highlightText: (text: string, query: string) => React.ReactNode;
  editingMessageId: string | null;
  editText: string;
  editInputRef: React.RefObject<HTMLTextAreaElement | null>;
  activeMenuId: string | null;
  copiedId: string | null;
  onContextMenu: (e: React.MouseEvent, msgId: string) => void;
  onLongPress: (msgId: string) => void;
  onCopy: (text: string, msgId: string) => void;
  onStartEdit: (msgId: string, text: string) => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onEditTextChange: (v: string) => void;
  onRegenerate?: (msgId: string) => void;
  onDelete: (msgId: string) => void;
  longPressTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

function UserAvatar({ userHandle }: { userHandle?: string }) {
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
}

function MessageBubbleInner({
  msg,
  isLast: _isLast,
  characterName,
  characterAvatar,
  userHandle,
  plainText,
  isBusy,
  isSearchHit,
  isCurrentSearchHit,
  searchQuery,
  highlightText,
  editingMessageId,
  editText,
  editInputRef,
  activeMenuId,
  copiedId,
  onContextMenu,
  onLongPress,
  onCopy,
  onStartEdit,
  onConfirmEdit,
  onCancelEdit,
  onEditTextChange,
  onRegenerate,
  onDelete,
  longPressTimerRef,
}: MessageBubbleProps) {
  void _isLast;
  const isUser = msg.role === 'user';
  const isEditing = editingMessageId === msg.id;

  return (
    <div
      className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''} ${
        isSearchHit
          ? isCurrentSearchHit
            ? 'ring-2 ring-yellow-400/50 rounded-2xl'
            : ''
          : ''
      }`}
      onContextMenu={(e) => onContextMenu(e, msg.id)}
      onTouchStart={() => {
        longPressTimerRef.current = setTimeout(() => onLongPress(msg.id), 500);
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
      {!isUser && (
        <img
          alt={characterName}
          src={characterAvatar}
          className="w-8 h-8 rounded-full object-cover border border-outline-variant/40 flex-shrink-0"
        />
      )}
      {isUser && <UserAvatar userHandle={userHandle} />}

      <div
        className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] border backdrop-blur-md relative cursor-context-menu ${
          isUser
            ? 'bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border-accent-pink/40 text-white rounded-tr-none'
            : 'bg-surface-container/80 border-outline-variant/10 text-[#e3e1ee] rounded-tl-none shadow-md'
        }`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={editInputRef}
              value={editText}
              onChange={(e) => onEditTextChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onConfirmEdit();
                }
                if (e.key === 'Escape') onCancelEdit();
              }}
              rows={3}
              className="w-full bg-surface-elevated/80 border border-accent-pink/40 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onConfirmEdit}
                className="px-3 py-1 bg-accent-pink/20 border border-accent-pink/40 rounded text-[10px] text-accent-pink hover:bg-accent-pink/30 cursor-pointer"
              >
                确认
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3 py-1 bg-surface-elevated/60 border border-outline-variant/30 rounded text-[10px] text-on-surface-variant hover:text-white cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap select-text">
            {searchQuery ? highlightText(msg.text, searchQuery) : msg.text}
          </p>
        ) : searchQuery || plainText ? (
          <p className="whitespace-pre-wrap select-text">
            {searchQuery ? highlightText(msg.text, searchQuery) : msg.text}
          </p>
        ) : (
          <div className="markdown-body select-text">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-1 border-t border-white/5 text-on-surface-variant/30 font-mono">
          <span
            className="text-[8px] text-on-surface-variant/40 cursor-default"
            title={msg.timestamp ? new Date(msg.timestamp).toLocaleString() : ''}
          >
            {formatChatDate(msg.timestamp)}
          </span>
          {!isUser && (
            <div
              className="flex items-end gap-[2px] h-3 px-1.5 py-0.5 rounded-md bg-accent-pink/5 border border-accent-pink/15 shadow-[0_0_8px_rgba(236,72,153,0.15)] overflow-hidden"
              title="Voice waveform"
            >
              <span className="w-[1.5px] h-2 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-one" />
              <span className="w-[1.5px] h-3.5 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-two" />
              <span className="w-[1.5px] h-1.5 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-three" />
              <span className="w-[1.5px] h-2.5 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-two" />
              <span className="w-[1.5px] h-1 bg-gradient-to-t from-accent-pink to-[#ffade2] rounded-full origin-bottom animate-wave-one" />
            </div>
          )}
        </div>

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
                type="button"
                onClick={() => onCopy(msg.text, msg.id)}
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
                  type="button"
                  onClick={() => onStartEdit(msg.id, msg.text)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-cyan-400"
                  title="编辑"
                  disabled={isBusy}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
              {!isUser && onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(msg.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-amber-400"
                  title="重新生成"
                  disabled={isBusy}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(msg.id)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-on-surface-variant hover:text-red-400"
                title="删除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function propsAreEqual(prev: MessageBubbleProps, next: MessageBubbleProps): boolean {
  return (
    prev.msg.id === next.msg.id
    && prev.msg.text === next.msg.text
    && prev.msg.timestamp === next.msg.timestamp
    && prev.idx === next.idx
    && prev.isLast === next.isLast
    && prev.plainText === next.plainText
    && prev.isBusy === next.isBusy
    && prev.isSearchHit === next.isSearchHit
    && prev.isCurrentSearchHit === next.isCurrentSearchHit
    && prev.searchQuery === next.searchQuery
    && prev.editingMessageId === next.editingMessageId
    && (prev.editingMessageId !== prev.msg.id || prev.editText === next.editText)
    && prev.activeMenuId === next.activeMenuId
    && prev.copiedId === next.copiedId
    && prev.characterAvatar === next.characterAvatar
    && prev.characterName === next.characterName
    && prev.userHandle === next.userHandle
  );
}

export const MessageBubble = memo(MessageBubbleInner, propsAreEqual);
