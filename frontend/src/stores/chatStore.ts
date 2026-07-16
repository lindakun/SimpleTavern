import { create } from 'zustand';
import type { ChatThread, ChatMessage, SendState } from '../types';

export type { SendState };

/** 历史分页游标（从末尾计 offset） */
export interface ChatHistoryPageMeta {
  hasMore: boolean;
  /** 下一次加载更早消息时的 offset（已从末尾加载的条数） */
  nextOffset: number;
  loadingOlder?: boolean;
}

interface ChatStore {
  // 聊天线程
  chatThreads: Record<string, ChatThread>;
  setChatThreads: (threads: Record<string, ChatThread>) => void;
  updateChatThread: (characterId: string, updater: (thread: ChatThread) => ChatThread) => void;
  deleteChatThreads: (characterIds: string[]) => void;
  clearChatThreads: () => void;

  // 发送状态
  sendingStates: Record<string, SendState>;
  setSendState: (characterId: string, state: SendState) => void;

  // 历史分页（key: characterId 或 characterId::chatFile）
  historyPage: Record<string, ChatHistoryPageMeta>;
  setHistoryPage: (characterId: string, meta: ChatHistoryPageMeta) => void;
  clearHistoryPage: (characterId: string) => void;

  // 当前角色活跃会话文件名（无 .jsonl）
  activeChatFiles: Record<string, string>;
  setActiveChatFile: (characterId: string, chatFile: string) => void;

  // 已加载聊天标记（key: characterId::chatFile）
  loadedChats: Set<string>;
  markLoaded: (key: string) => void;
  resetLoaded: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  // 聊天线程
  chatThreads: {},
  setChatThreads: (threads) => set({ chatThreads: threads }),
  updateChatThread: (characterId, updater) =>
    set((state) => {
      const current = state.chatThreads[characterId] || {
        characterId,
        messages: [] as ChatMessage[],
        unreadCount: 0,
      };
      return {
        chatThreads: {
          ...state.chatThreads,
          [characterId]: updater(current),
        },
      };
    }),
  deleteChatThreads: (characterIds) =>
    set((state) => {
      const next = { ...state.chatThreads };
      const nextPage = { ...state.historyPage };
      for (const id of characterIds) {
        delete next[id];
        delete nextPage[id];
      }
      return { chatThreads: next, historyPage: nextPage };
    }),
  clearChatThreads: () => set({ chatThreads: {}, historyPage: {} }),

  // 发送状态
  sendingStates: {},
  setSendState: (characterId, state) =>
    set((prev) => ({
      sendingStates: { ...prev.sendingStates, [characterId]: state },
    })),

  historyPage: {},
  setHistoryPage: (characterId, meta) =>
    set((state) => ({
      historyPage: { ...state.historyPage, [characterId]: meta },
    })),
  clearHistoryPage: (characterId) =>
    set((state) => {
      const next = { ...state.historyPage };
      delete next[characterId];
      return { historyPage: next };
    }),

  activeChatFiles: {},
  setActiveChatFile: (characterId, chatFile) =>
    set((state) => ({
      activeChatFiles: { ...state.activeChatFiles, [characterId]: chatFile || 'chat' },
    })),

  // 已加载聊天标记
  loadedChats: new Set<string>(),
  markLoaded: (key) =>
    set((state) => {
      const next = new Set(state.loadedChats);
      next.add(key);
      return { loadedChats: next };
    }),
  resetLoaded: () => set({ loadedChats: new Set() }),
}));

/** 读取角色当前会话文件名 */
export function getActiveChatFileName(characterId: string): string {
  return useChatStore.getState().activeChatFiles[characterId] || 'chat';
}

/** 加载缓存键 */
export function sessionLoadKey(characterId: string, chatFile?: string): string {
  return `${characterId}::${chatFile || getActiveChatFileName(characterId)}`;
}
