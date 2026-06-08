import { useState, useEffect, useCallback, lazy, Suspense, useMemo, useRef } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenId, Character, ChatThread, ChatMessage } from './types';
import { FAQS } from './data';
import { useToast } from './components/Toast.tsx';
import { registerServiceWorker } from './sw-register';
import { useUserApi } from './api/users';
import { useCharacterApi } from './api/characters';
import { useChatApi } from './api/chat';
import { registerUnauthorizedCallback } from './api/client';
import { fromStoredChatMessages, toStoredChatMessages } from './utils/chatMessages';
import { cacheMessages, cacheThreads, getCachedMessages, getCachedThreads } from './utils/chatCache';
import { initAnalytics, trackPageView, track } from './utils/analytics';
import { useFavorites, useToggleFavorite } from './hooks/useFavorites';
import { useCurrentUser } from './hooks/useAuth';
import { useChatStore } from './stores/chatStore';
import { useCharacterStore } from './stores/characterStore';

// Import our modular screens — lazy loaded for code splitting
import SplashScreen from './components/SplashScreen';
const WelcomeScreen = lazy(() => import('./components/WelcomeScreen'));
const LoginScreen = lazy(() => import('./components/LoginScreen'));
const RegisterScreen = lazy(() => import('./components/RegisterScreen'));
const DiscoverScreen = lazy(() => import('./components/DiscoverScreen'));
const CharacterDetailScreen = lazy(() => import('./components/CharacterDetailScreen'));
const ChatScreen = lazy(() => import('./components/ChatScreen'));
const CreateChoiceScreen = lazy(() => import('./components/CreateChoiceScreen'));
const CreateCharacterScreen = lazy(() => import('./components/CreateCharacterScreen'));
const MessageCenterScreen = lazy(() => import('./components/MessageCenterScreen'));
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
const MyCharactersScreen = lazy(() => import('./components/MyCharactersScreen'));
const MyFavoritesScreen = lazy(() => import('./components/MyFavoritesScreen'));
const SettingsScreen = lazy(() => import('./components/SettingsScreen'));
const HelpFeedbackScreen = lazy(() => import('./components/HelpFeedbackScreen'));
const ForgotPasswordScreen = lazy(() => import('./components/ForgotPasswordScreen'));
const ResetPasswordScreen = lazy(() => import('./components/ResetPasswordScreen'));
const WorldBookManageScreen = lazy(() => import('./components/WorldBookManageScreen'));

// ── ScreenId ↔ URL Path mapping ──
const SCREEN_PATHS: Record<ScreenId, string> = {
  [ScreenId.WELCOME]: '/',
  [ScreenId.LOGIN]: '/login',
  [ScreenId.REGISTER]: '/register',
  [ScreenId.FORGOT_PASSWORD]: '/forgot-password',
  [ScreenId.RESET_PASSWORD]: '/reset-password',
  [ScreenId.DISCOVER]: '/discover',
  [ScreenId.CHARACTER_DETAIL]: '/character',
  [ScreenId.CHAT]: '/chat',
  [ScreenId.CREATE_CHOICE]: '/create',
  [ScreenId.CREATE_CHARACTER]: '/create-character',
  [ScreenId.MESSAGE_CENTER]: '/messages',
  [ScreenId.PROFILE]: '/profile',
  [ScreenId.MY_CHARACTERS]: '/my-characters',
  [ScreenId.MY_FAVORITES]: '/favorites',
  [ScreenId.SETTINGS]: '/settings',
  [ScreenId.WORLD_BOOK_MANAGE]: '/world-book',
  [ScreenId.HELP_FEEDBACK]: '/help',
};

const pathToScreen = (path: string): ScreenId | null => {
  for (const [screen, p] of Object.entries(SCREEN_PATHS)) {
    if (path === p || path.startsWith(p + '/')) return screen as ScreenId;
  }
  return null;
};

export default function App() {
  // 注册 Service Worker（生产环境）
  useEffect(() => { registerServiceWorker(); }, []);
  // 初始化埋点
  useEffect(() => { initAnalytics(); }, []);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const currentScreen = pathToScreen(location.pathname);

  const [activeCharacterId, setActiveCharacterId] = useState<string>('yuki');

  // ── Zustand stores ──
  const {
    characters, editingCharacter,
    updateCharacter: storeUpdateChar,
    removeCharacter: storeRemoveChar, setEditingCharacter,
  } = useCharacterStore();
  const {
    chatThreads, sendingStates,
    updateChatThread, deleteChatThreads,
    markLoaded,
  } = useChatStore();

  // React Query 管理的服务端状态
  const { data: currentUser, isFetched } = useCurrentUser();
  const user = currentUser
    ? { username: currentUser.handle, email: `${currentUser.handle}@yuzu.ai` }
    : null;
  const { data: favoriteIds = [] } = useFavorites();
  const { toggleFavorite } = useToggleFavorite();

  const { showToast } = useToast();
  const userApi = useUserApi();
  const characterApi = useCharacterApi();
  const chatApi = useChatApi();
  const prevUserRef = useRef(user);

  // 注册 401 全局回调
  useEffect(() => {
    registerUnauthorizedCallback(() => {
      queryClient.clear();
      useChatStore.getState().clearChatThreads();
      useChatStore.getState().resetLoaded();
      navigate('/', { replace: true });
    });
  }, [queryClient, navigate]);

  // 认证守卫
  useEffect(() => {
    const publicScreens: ScreenId[] = [
      ScreenId.WELCOME, ScreenId.LOGIN, ScreenId.REGISTER,
      ScreenId.FORGOT_PASSWORD, ScreenId.RESET_PASSWORD,
    ];
    const wasLoggedIn = prevUserRef.current !== null;
    prevUserRef.current = user;

    if (wasLoggedIn && !user && currentScreen && !publicScreens.includes(currentScreen)) {
      navigate('/', { replace: true });
    }
  }, [user, currentScreen, navigate]);

  // Splash Screen 状态
  const [splashComplete, setSplashComplete] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashComplete(true), []);

  // 从后端加载角色数据
  useEffect(() => {
    Promise.all([
      characterApi.getDiscoverCharacters().catch(() => []),
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
    ]).then(([discoverData, charsData, pngCharsData]) => {
      if (Array.isArray(discoverData) && discoverData.length > 0) {
        useCharacterStore.getState().setCharacters(discoverData);
      }
      const mergeChars = (data: Character[]) => {
        if (Array.isArray(data) && data.length > 0) {
          useCharacterStore.getState().addCharacters(data);
        }
      };
      mergeChars(charsData);
      mergeChars(pngCharsData);
    });
  }, []);

  // 恢复 cookie-session → 决定跳转页面（仅首次）
  const didInitRoute = useRef(false);
  useEffect(() => {
    if (!isFetched || didInitRoute.current) return;
    didInitRoute.current = true;
    if (currentUser) {
      navigate('/discover', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [isFetched, currentUser, navigate]);

  // ── 导航 ──
  const handleNavigate = useCallback((screen: ScreenId) => {
    const path = SCREEN_PATHS[screen];
    trackPageView(screen);
    navigate(path);
  }, [navigate]);

  const handleGoBack = useCallback((_fallback: ScreenId) => {
    navigate(-1);
  }, [navigate]);

  const handleLogin = useCallback(async (input: string, password?: string) => {
    const data = await userApi.login({ handle: input, password });
    queryClient.setQueryData(['user', 'me'], { handle: data.handle || input, name: data.handle });
    showToast(`欢迎回来，${data.handle || input}！`, 'success');
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    track('login', { username: data.handle || input });
  }, [showToast, userApi, queryClient]);

  // Google OAuth 登录
  const handleGoogleLogin = useCallback(async (idToken: string) => {
    try {
      await userApi.googleLogin(idToken);
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`Google 登录失败: ${message}`, 'error');
      throw err;
    }
  }, [showToast, userApi, queryClient]);

  const handleRegister = useCallback(async (username: string, email: string, password?: string) => {
    await userApi.register({ handle: username, name: username, password, email });
    queryClient.setQueryData(['user', 'me'], { handle: username, name: username });
    showToast('注册成功，欢迎加入！', 'success');
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    track('register', { username });
  }, [showToast, userApi, queryClient]);

  const handleLogout = useCallback(async () => {
    track('logout');
    await userApi.logout().catch(() => {});
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('simpletavern-')).map(k => caches.delete(k)));
      } catch { /* ignore */ }
    }
    queryClient.clear();
    useChatStore.getState().clearChatThreads();
    useChatStore.getState().resetLoaded();
    navigate('/', { replace: true });
    characterApi.getDiscoverCharacters()
      .then(data => {
        if (Array.isArray(data)) useCharacterStore.getState().setCharacters(data);
      })
      .catch(() => {});
  }, [characterApi, userApi, queryClient, navigate]);

  // Toggle character in favorites
  const handleToggleFavorite = useCallback((characterId: string) => {
    toggleFavorite(characterId);
    track('toggle_favorite', { character_id: characterId, source: 'button' });
  }, [toggleFavorite]);

  // Publish / update character
  const handlePublishCharacter = useCallback(async (newChar: Character) => {
    const editChar = useCharacterStore.getState().editingCharacter;
    const isEdit = !!editChar;
    if (isEdit) {
      const isPngCharacter = editChar.id.endsWith('.png');
      if (isPngCharacter) {
        await characterApi.updateCharacter({ ...newChar, avatar_url: editChar.id, avatar: editChar.id });
        storeUpdateChar(newChar);
      } else {
        const saved = await characterApi.updateUserCharacter(newChar);
        storeUpdateChar(saved);
      }
      setEditingCharacter(null);
    } else {
      const saved = await characterApi.publishCharacter(newChar);
      storeRemoveChar(saved.id);
      const currentChars = useCharacterStore.getState().characters;
      useCharacterStore.getState().setCharacters([saved, ...currentChars]);
      track('create_character', { character_id: saved.id, character_name: saved.name });
    }
  }, [characterApi, storeUpdateChar, setEditingCharacter, storeRemoveChar]);

  // Append reviews
  const handleAddReview = useCallback(async (characterId: string, review: Character['reviews'] extends (infer R)[] | undefined ? R : never) => {
    try {
      const updatedChar = await characterApi.addReview(characterId, review);
      storeUpdateChar(updatedChar);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '评价提交失败';
      showToast(message, 'error');
      throw err;
    }
  }, [characterApi, showToast, storeUpdateChar]);

  // 快捷切换角色隐私类型
  const handleUpdatePrivacy = useCallback(async (characterId: string, privacyType: 'public' | 'private') => {
    try {
      const updated = await characterApi.updateCharacterPrivacy(characterId, privacyType);
      storeUpdateChar(updated);
      showToast(privacyType === 'public' ? '角色已设为公开' : '角色已设为私有', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '隐私设置修改失败';
      showToast(message, 'error');
    }
  }, [characterApi, showToast, storeUpdateChar]);

  // 复制公共角色
  const handleCopyCharacter = useCallback(async (character: Character) => {
    try {
      const copy = await characterApi.copyCharacter(character);
      const currentChars = useCharacterStore.getState().characters;
      useCharacterStore.getState().setCharacters([copy, ...currentChars.filter(c => c.id !== copy.id)]);
      showToast(`已复制角色「${copy.name}」到我的角色（私有）`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '复制角色失败';
      showToast(message, 'error');
    }
  }, [characterApi, showToast]);

  // Messaging dispatcher calling backend (streaming SSE)
  const handleSendMessage = useCallback(async (characterId: string, text: string) => {
    const chatStore = useChatStore.getState();
    const charStore = useCharacterStore.getState();

    const curState = chatStore.sendingStates[characterId] || 'idle';
    if (curState === 'sending' || curState === 'streaming') {
      showToast('AI 正在回复中，请等待回复完成后再发送', 'info');
      return;
    }

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const currentThread = chatStore.chatThreads[characterId] || {
      characterId,
      messages: [],
      unreadCount: 0,
    };

    const updatedThreadMessages = [...currentThread.messages, userMsg];

    const aiPlaceholderId = 'msg_ai_' + Date.now();
    const aiPlaceholder: ChatMessage = {
      id: aiPlaceholderId,
      role: 'model',
      text: '',
      timestamp: new Date().toISOString(),
    };

    chatStore.setChatThreads({
      ...chatStore.chatThreads,
      [characterId]: {
        ...currentThread,
        messages: [...updatedThreadMessages, aiPlaceholder],
      },
    });

    chatStore.setSendState(characterId, 'sending');

    const chatCharacter = charStore.characters.find((c) => c.id === characterId)
      || charStore.characters[0];
    if (!chatCharacter) {
      showToast('角色不存在', 'error');
      chatStore.setSendState(characterId, 'error');
      return;
    }

    let streamedText = '';

    try {
      await new Promise<void>((resolve, reject) => {
        chatApi.sendMessageStream(
          {
            message: text,
            history: currentThread.messages.map((m) => ({ role: m.role, text: m.text })),
            characterName: chatCharacter.name,
            characterDescription: chatCharacter.description,
            personality: chatCharacter.personality,
            scenario: chatCharacter.scenario,
            first_mes: chatCharacter.first_mes,
            mes_example: chatCharacter.mes_example,
            system_prompt: chatCharacter.system_prompt,
            post_history_instructions: chatCharacter.post_history_instructions,
            alternate_greetings: chatCharacter.alternate_greetings,
            worldBook: chatCharacter.worldBook,
          },
          (chunk: string) => {
            if (!streamedText) {
              useChatStore.getState().setSendState(characterId, 'streaming');
            }
            streamedText += chunk;
            useChatStore.getState().updateChatThread(characterId, (thread) => {
              const msgs = thread.messages.map(m =>
                m.id === aiPlaceholderId ? { ...m, text: streamedText } : m,
              );
              return { ...thread, messages: msgs };
            });
          },
          () => {
            const finalMessages = [
              ...updatedThreadMessages,
              { ...aiPlaceholder, text: streamedText || '……发生连接断裂。' },
            ];
            chatApi.saveChat(characterId, toStoredChatMessages(chatCharacter, finalMessages)).catch(() => {});
            cacheMessages(characterId, [
              ...updatedThreadMessages,
              { ...aiPlaceholder, text: streamedText || '' },
            ]);
            useChatStore.getState().setSendState(characterId, 'idle');
            resolve();
          },
          (err: Error) => {
            const message = err.message || '消息发送失败';
            showToast(`消息发送失败: ${message}`, 'error');
            const errorMsg: ChatMessage = {
              id: 'msg_err_' + Date.now(),
              role: 'model',
              text: `（发送失败：${message}）`,
              timestamp: new Date().toISOString(),
            };
            const store = useChatStore.getState();
            store.setChatThreads({
              ...store.chatThreads,
              [characterId]: {
                ...store.chatThreads[characterId],
                messages: [...updatedThreadMessages, errorMsg],
              },
            });
            useChatStore.getState().setSendState(characterId, 'error');
            reject(err);
          },
        );
      });
    } catch {
      useChatStore.getState().setSendState(characterId, 'error');
    }
  }, [chatApi, showToast]);

  // 删除单条消息
  const handleDeleteMessage = useCallback((characterId: string, messageId: string) => {
    const chatStore = useChatStore.getState();
    const thread = chatStore.chatThreads[characterId];
    if (!thread) return;
    const newMessages = thread.messages.filter(m => m.id !== messageId);
    chatStore.updateChatThread(characterId, () => ({
      ...thread,
      messages: newMessages,
    }));
    // 异步保存到后端（不阻塞 UI）
    const charStore = useCharacterStore.getState();
    const chatChar = charStore.characters.find(c => c.id === characterId) || charStore.characters[0];
    if (chatChar) {
      chatApi.saveChat(characterId, toStoredChatMessages(chatChar, newMessages)).catch(() => {});
      cacheMessages(characterId, newMessages);
    }
  }, [chatApi]);

  // 删除角色
  const handleDeleteCharacter = useCallback(async (characterId: string) => {
    const charStore = useCharacterStore.getState();
    const char = charStore.characters.find(c => c.id === characterId);
    if (!char) return;
    try {
      if (char.id.startsWith('custom_')) {
        await characterApi.deleteUserCharacter(characterId);
      } else if (char.id.endsWith('.png')) {
        await characterApi.deleteCharacter(char.id);
      } else {
        await characterApi.deleteCharacter(char.avatar);
      }
      storeRemoveChar(characterId);
      showToast('角色已删除', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败';
      showToast(message, 'error');
    }
  }, [characterApi, showToast, storeRemoveChar]);

  // 加载聊天线程（匿名用户时加载）
  useEffect(() => {
    if (!isFetched || currentUser) return;
    chatApi.getThreads()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const chatStore = useChatStore.getState();
          const merged = { ...chatStore.chatThreads };
          for (const thread of data) {
            if (!merged[thread.characterId]) {
              merged[thread.characterId] = {
                ...thread,
                messages: thread.messages || [],
                unreadCount: thread.unreadCount || 0,
              };
            }
          }
          chatStore.setChatThreads(merged);
          cacheThreads(data as any);
        }
      })
      .catch(() => {});
  }, [isFetched, currentUser, chatApi]);

  useEffect(() => {
    if (!currentUser) return;
    useChatStore.getState().clearChatThreads();
    Promise.all([
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
      chatApi.getThreads().catch(() => []),
    ]).then(([charsData, pngCharsData, threadsData]) => {
      const mergeChars = (data: Character[]) => {
        if (Array.isArray(data) && data.length > 0) {
          useCharacterStore.getState().addCharacters(data);
        }
      };
      mergeChars(charsData);
      mergeChars(pngCharsData);
      if (Array.isArray(threadsData)) {
        const threads: Record<string, ChatThread> = {};
        for (const thread of threadsData) {
          threads[thread.characterId] = {
            ...thread,
            messages: thread.messages || [],
            unreadCount: thread.unreadCount || 0,
          };
        }
        useChatStore.getState().setChatThreads(threads);
        cacheThreads(threadsData as any);
      }
    })
    .catch(() => {
      getCachedThreads().then(cached => {
        if (cached.length > 0) {
          const threads: Record<string, ChatThread> = {};
          for (const thread of cached) {
            threads[thread.characterId] = {
              characterId: thread.characterId,
              messages: [],
              unreadCount: 0,
              lastMessageText: thread.lastMessageText,
              updatedAt: new Date(thread.updatedAt).toISOString(),
              pinned: thread.pinned,
            };
          }
          useChatStore.getState().setChatThreads(threads);
        }
      });
    });
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // 进入聊天时加载已有聊天记录
  const loadedChats = useChatStore(s => s.loadedChats);
  useEffect(() => {
    if (currentScreen !== ScreenId.CHAT || !activeCharacterId) return;
    if (loadedChats.has(activeCharacterId)) return;
    markLoaded(activeCharacterId);
    chatApi.getChat(activeCharacterId)
      .then(data => {
        const messages = fromStoredChatMessages(data);
        if (messages.length > 0) {
          useChatStore.getState().updateChatThread(activeCharacterId, (prev) => ({
            ...prev,
            characterId: activeCharacterId,
            messages,
            unreadCount: 0,
          }));
          cacheMessages(activeCharacterId, messages);
        }
      })
      .catch(() => {
        getCachedMessages(activeCharacterId).then(cached => {
          if (cached.length > 0) {
            useChatStore.getState().updateChatThread(activeCharacterId, (prev) => ({
              ...prev,
              characterId: activeCharacterId,
              messages: cached,
              unreadCount: 0,
            }));
          }
        });
      });
  }, [chatApi, currentScreen, activeCharacterId, loadedChats, markLoaded]);

  const currentCharacter = characters.find((c) => c.id === activeCharacterId) || characters[0] || null;

  // 当前用户自己的角色（仅用于 MyCharactersScreen）
  const currentUserHandle = user?.username;
  const userCharacters = useMemo(
    () => {
      if (!currentUserHandle) return [];
      return characters.filter((c) => {
        if (!(c.id.startsWith('custom_') || c.id.endsWith('.png'))) return false;
        return !c.creator || c.creator === currentUserHandle;
      });
    },
    [characters, currentUserHandle],
  );

  const myCharactersCount = useMemo(
    () => userCharacters.length,
    [userCharacters],
  );

  // 公开角色（仅用于 DiscoverScreen 公共广场）
  const publicCharacters = useMemo(
    () => characters.filter(c => c.privacyType !== 'private'),
    [characters],
  );

  // Splash Screen
  if (!splashComplete) {
    return (
      <SplashScreen
        ready={currentScreen !== null && isFetched}
        onComplete={handleSplashComplete}
      />
    );
  }

  // Loading fallback
  if (currentScreen === null) {
    return (
      <div className="h-dvh w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex gap-2 justify-center">
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-accent-pink animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm text-on-surface-variant">正在连接服务器...</p>
        </div>
      </div>
    );
  }

  // ── 路由渲染 ──
  return (
    <div className="h-dvh w-full bg-[#090A0F] text-[#E0E0E6] flex flex-col justify-self-center overflow-hidden max-w-lg mx-auto shadow-[0_0_80px_rgba(9,10,15,0.95)] border-x border-white/5 relative safe-top">
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="h-full w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center"><div className="text-center space-y-4"><div className="text-4xl">🔄</div><p className="text-sm text-on-surface-variant">加载中...</p></div></div>}>          <div
          key={location.pathname}
          className="flex-1 flex flex-col min-h-0"
        >
          <Routes location={location}>
            {/* 公开页面 */}
            <Route path="/" element={<WelcomeScreen onNavigate={handleNavigate} onGoogleLogin={handleGoogleLogin} />} />
            <Route path="/login" element={<LoginScreen onNavigate={handleNavigate} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />} />
            <Route path="/register" element={<RegisterScreen onNavigate={handleNavigate} onRegister={handleRegister} onGoogleLogin={handleGoogleLogin} />} />
            <Route path="/forgot-password" element={<ForgotPasswordScreen onNavigate={handleNavigate} />} />
            <Route path="/reset-password" element={<ResetPasswordScreen onNavigate={handleNavigate} />} />

            {/* 受保护页面 */}
            <Route path="/discover" element={
              <DiscoverScreen
                characters={publicCharacters}
                favoriteIds={favoriteIds as string[]}
                onNavigate={handleNavigate}
                onSelectCharacter={(id) => {
                  setActiveCharacterId(id);
                  const store = useChatStore.getState();
                  if (store.chatThreads[id]) {
                    store.updateChatThread(id, (prev) => ({ ...prev, unreadCount: 0 }));
                  }
                }}
                toggleFavorite={handleToggleFavorite}
              />
            } />
            <Route path="/character" element={
              currentCharacter ? (
                <CharacterDetailScreen
                  character={currentCharacter as Character}
                  userHandle={user?.username}
                  favoriteIds={favoriteIds as string[]}
                  toggleFavorite={handleToggleFavorite}
                  onNavigate={handleNavigate}
                  onGoBack={() => handleGoBack(ScreenId.DISCOVER)}
                  onSelectCharacter={setActiveCharacterId}
                  onAddReview={handleAddReview}
                  onCopyCharacter={handleCopyCharacter}
                />
              ) : <Navigate to="/discover" replace />
            } />
            <Route path="/chat" element={
              currentCharacter ? (
                <ChatScreen
                  character={currentCharacter as Character}
                  messages={chatThreads[activeCharacterId]?.messages || []}
                  onSendMessage={handleSendMessage}
                  onDeleteMessage={handleDeleteMessage}
                  onNavigate={handleNavigate}
                  onGoBack={() => handleGoBack(ScreenId.MESSAGE_CENTER)}
                  sendState={sendingStates[activeCharacterId] || 'idle'}
                />
              ) : <Navigate to="/discover" replace />
            } />
            <Route path="/create" element={<CreateChoiceScreen onNavigate={handleNavigate} />} />
            <Route path="/create-character" element={
              <CreateCharacterScreen
                onNavigate={(screen) => { setEditingCharacter(null); handleNavigate(screen); }}
                onGoBack={() => handleGoBack(ScreenId.MY_CHARACTERS)}
                onPublish={handlePublishCharacter}
                editCharacter={editingCharacter}
              />
            } />
            <Route path="/messages" element={
              <MessageCenterScreen
                characters={characters}
                chatThreads={chatThreads}
                onNavigate={handleNavigate}
                onSelectCharacter={setActiveCharacterId}
                onDeleteChatThreads={(characterIds) => { deleteChatThreads(characterIds); }}
                onTogglePinChat={(characterId, pinned) => {
                  updateChatThread(characterId, (prev) => ({ ...prev, pinned }));
                }}
              />
            } />
            <Route path="/profile" element={
              <ProfileScreen
                user={user}
                favoriteCount={(favoriteIds as string[]).length}
                myCharactersCount={myCharactersCount}
                onNavigate={handleNavigate}
                onLogout={handleLogout}
              />
            } />
            <Route path="/my-characters" element={
              <MyCharactersScreen
                characters={userCharacters}
                onNavigate={handleNavigate}
                onSelectCharacter={setActiveCharacterId}
                onEditCharacter={(char) => setEditingCharacter(char)}
                onDeleteCharacter={handleDeleteCharacter}
                onUpdatePrivacy={handleUpdatePrivacy}
              />
            } />
            <Route path="/favorites" element={
              <MyFavoritesScreen
                characters={characters}
                favoriteIds={favoriteIds as string[]}
                onNavigate={handleNavigate}
                onSelectCharacter={setActiveCharacterId}
                toggleFavorite={handleToggleFavorite}
              />
            } />
            <Route path="/settings" element={<SettingsScreen onNavigate={handleNavigate} />} />
            <Route path="/world-book" element={<WorldBookManageScreen onNavigate={handleNavigate} />} />
            <Route path="/help" element={<HelpFeedbackScreen faqs={FAQS} onNavigate={handleNavigate} />} />

            {/* 兜底：未匹配路由 → 发现页 */}
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Routes>
        </div>
        </Suspense>
      </AnimatePresence>
    </div>
  );
}
