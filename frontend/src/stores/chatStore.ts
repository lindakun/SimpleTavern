import { create } from 'zustand';
import type { ChatThread, ChatMessage, SendState } from '../types';

export type { SendState };

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

  // 已加载聊天标记
  loadedChats: Set<string>;
  markLoaded: (characterId: string) => void;
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
      for (const id of characterIds) {
        delete next[id];
      }
      return { chatThreads: next };
    }),
  clearChatThreads: () => set({ chatThreads: {} }),

  // 发送状态
  sendingStates: {},
  setSendState: (characterId, state) =>
    set((prev) => ({
      sendingStates: { ...prev.sendingStates, [characterId]: state },
    })),

  // 已加载聊天标记
  loadedChats: new Set<string>(),
  markLoaded: (characterId) =>
    set((state) => {
      const next = new Set(state.loadedChats);
      next.add(characterId);
      return { loadedChats: next };
    }),
  resetLoaded: () => set({ loadedChats: new Set() }),
}));
