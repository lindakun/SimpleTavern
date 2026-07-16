/**
 * 聊天历史 API 响应归一化
 */
import { fromStoredChatMessages } from './chatMessages';
import type { ChatMessage } from '../types';

export interface NormalizedChatPage {
  messages: ChatMessage[];
  hasMore: boolean;
  nextOffset: number;
  totalMessages: number;
}

/**
 * 兼容：完整数组 或 分页对象 { chat, hasMore, ... }
 */
export function normalizeChatGetResponse(data: unknown): NormalizedChatPage {
  if (Array.isArray(data)) {
    const messages = fromStoredChatMessages(data);
    return {
      messages,
      hasMore: false,
      nextOffset: messages.length,
      totalMessages: messages.length,
    };
  }

  if (data && typeof data === 'object' && 'chat' in (data as object)) {
    const d = data as {
      chat: unknown;
      hasMore?: boolean;
      totalMessages?: number;
      offset?: number;
      limit?: number;
    };
    const messages = fromStoredChatMessages(d.chat);
    const offset = d.offset ?? 0;
    return {
      messages,
      hasMore: Boolean(d.hasMore),
      nextOffset: offset + messages.length,
      totalMessages: d.totalMessages ?? messages.length,
    };
  }

  return { messages: [], hasMore: false, nextOffset: 0, totalMessages: 0 };
}
