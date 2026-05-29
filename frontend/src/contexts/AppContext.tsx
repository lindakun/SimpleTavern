/**
 * 全局应用状态管理
 *
 * 使用 React Context 管理全局状态，避免 props drilling
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ScreenId } from '../types';
import type { Character, ChatThread, ChatMessage } from '../types';

// 用户类型
export interface AppUser {
  handle: string;
  name: string;
  email?: string;
  avatar?: string;
  isAdmin?: boolean;
}

// Context 类型
interface AppContextValue {
  // 导航状态
  currentScreen: ScreenId;
  setCurrentScreen: (screen: ScreenId) => void;

  // 用户状态
  user: AppUser | null;
  setUser: (user: AppUser | null) => void;

  // 角色状态
  characters: Character[];
  setCharacters: (characters: Character[]) => void;
  addCharacter: (character: Character) => void;
  removeCharacter: (characterId: string) => void;
  updateCharacter: (character: Character) => void;

  // 当前选中角色
  activeCharacterId: string;
  setActiveCharacterId: (id: string) => void;

  // 编辑中的角色
  editingCharacter: Character | null;
  setEditingCharacter: (character: Character | null) => void;

  // 聊天状态
  chatThreads: Record<string, ChatThread>;
  setChatThreads: (threads: Record<string, ChatThread>) => void;
  addChatMessage: (characterId: string, message: ChatMessage) => void;
  updateChatThread: (characterId: string, thread: ChatThread) => void;

  // 收藏状态
  favoriteIds: string[];
  setFavoriteIds: (ids: string[]) => void;
  toggleFavorite: (characterId: string) => void;

  // 导航历史
  navigationHistory: ScreenId[];
  goBack: () => void;
}

// 创建 Context
const AppContext = createContext<AppContextValue | null>(null);

// Provider 组件
export function AppProvider({ children }: { children: ReactNode }) {
  // 导航状态
  const [currentScreen, setCurrentScreen] = useState(ScreenId.WELCOME);
  const [navigationHistory, setNavigationHistory] = useState<ScreenId[]>([]);

  // 用户状态
  const [user, setUser] = useState<AppUser | null>(null);

  // 角色状态
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string>('');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  // 聊天状态
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});

  // 收藏状态
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  // 导航处理
  const handleSetCurrentScreen = useCallback((screen: ScreenId) => {
    setNavigationHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
  }, [currentScreen]);

  // 返回上一页
  const goBack = useCallback(() => {
    setNavigationHistory((prev) => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const previousScreen = newHistory.pop()!;
      setCurrentScreen(previousScreen);
      return newHistory;
    });
  }, []);

  // 角色操作
  const addCharacter = useCallback((character: Character) => {
    setCharacters((prev) => {
      const exists = prev.some((c) => c.id === character.id);
      if (exists) {
        return prev.map((c) => (c.id === character.id ? character : c));
      }
      return [character, ...prev];
    });
  }, []);

  const removeCharacter = useCallback((characterId: string) => {
    setCharacters((prev) => prev.filter((c) => c.id !== characterId));
  }, []);

  const updateCharacter = useCallback((character: Character) => {
    setCharacters((prev) =>
      prev.map((c) => (c.id === character.id ? character : c))
    );
  }, []);

  // 聊天操作
  const addChatMessage = useCallback((characterId: string, message: ChatMessage) => {
    setChatThreads((prev) => {
      const thread = prev[characterId] || {
        characterId,
        messages: [],
        unreadCount: 0,
      };
      return {
        ...prev,
        [characterId]: {
          ...thread,
          messages: [...thread.messages, message],
        },
      };
    });
  }, []);

  const updateChatThread = useCallback((characterId: string, thread: ChatThread) => {
    setChatThreads((prev) => ({
      ...prev,
      [characterId]: thread,
    }));
  }, []);

  // 收藏操作
  const toggleFavorite = useCallback((characterId: string) => {
    setFavoriteIds((prev) => {
      if (prev.includes(characterId)) {
        return prev.filter((id) => id !== characterId);
      }
      return [...prev, characterId];
    });
  }, []);

  const value: AppContextValue = {
    currentScreen,
    setCurrentScreen: handleSetCurrentScreen,
    user,
    setUser,
    characters,
    setCharacters,
    addCharacter,
    removeCharacter,
    updateCharacter,
    activeCharacterId,
    setActiveCharacterId,
    editingCharacter,
    setEditingCharacter,
    chatThreads,
    setChatThreads,
    addChatMessage,
    updateChatThread,
    favoriteIds,
    setFavoriteIds,
    toggleFavorite,
    navigationHistory,
    goBack,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// 自定义 Hook
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// 导出 Context（用于测试或特殊场景）
export { AppContext };
