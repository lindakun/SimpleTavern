import { useState, useEffect, useCallback, lazy, Suspense, useMemo, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { ScreenId, Character, ChatThread, ChatMessage, RouteState, SendState, CharacterSendState } from './types';
import { FAQS } from './data';
import { useToast } from './components/Toast.tsx';
import { registerServiceWorker } from './sw-register';
import { useUserApi } from './api/users';
import { useCharacterApi } from './api/characters';
import { useChatApi } from './api/chat';
import { fromStoredChatMessages, toStoredChatMessages } from './utils/chatMessages';
import { cacheMessages, cacheThreads, getCachedMessages, getCachedThreads } from './utils/chatCache';
import { initAnalytics, trackPageView, track } from './utils/analytics';
import { useFavorites, useToggleFavorite } from './hooks/useFavorites';
import { useCurrentUser } from './hooks/useAuth';

// Import our modular screens — lazy loaded for code splitting
import GoogleCallback from './components/GoogleCallback';
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

export default function App() {
  // 注册 Service Worker（生产环境）
  useEffect(() => { registerServiceWorker(); }, []);
  // 初始化埋点
  useEffect(() => { initAnalytics(); }, []);

  // Google OAuth 回调路由 — 弹窗中独立渲染
  if (window.location.pathname === '/auth/google/callback') {
    return <GoogleCallback />;
  }

  const queryClient = useQueryClient();
  const [currentScreen, setCurrentScreen] = useState<ScreenId | null>(null);
  const [navigationStack, setNavigationStack] = useState<ScreenId[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string>('yuki');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  // React Query 管理的服务端状态
  const { data: currentUser, isFetched } = useCurrentUser();
  const user = currentUser
    ? { username: currentUser.handle, email: `${currentUser.handle}@yuzu.ai` }
    : null;
  const { data: favoriteIds = [] } = useFavorites();
  const { toggleFavorite } = useToggleFavorite();

  // UI 本地状态 — 仍使用 useState
  const [characters, setCharacters] = useState<Character[]>([]);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const { showToast } = useToast();
  const userApi = useUserApi();
  const characterApi = useCharacterApi();
  const chatApi = useChatApi();
  const didInitHistory = useRef(false);
  const navSourceRef = useRef<ScreenId>(ScreenId.DISCOVER);

  // 发送队列管理：每个角色的发送状态
  const sendingStatesRef = useRef<Map<string, CharacterSendState>>(new Map());
  const [sendingStates, setSendingStates] = useState<Record<string, SendState>>({});

  // Splash Screen 状态
  const [splashComplete, setSplashComplete] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashComplete(true), []);

  // 从后端加载角色数据（React Query 已接管 favorites/user）
  useEffect(() => {
    Promise.all([
      characterApi.getDiscoverCharacters().catch(() => []),
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
    ]).then(([discoverData, charsData, pngCharsData]) => {
      if (Array.isArray(discoverData) && discoverData.length > 0) setCharacters(discoverData);
      const mergeChars = (data: Character[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newChars = data.filter((c: Character) => !existingIds.has(c.id));
            return [...prev, ...newChars];
          });
        }
      };
      mergeChars(charsData);
      mergeChars(pngCharsData);
    });
  }, []);

  // 恢复 cookie-session → React Query 的 useCurrentUser 自动处理
  // 等 React Query 完成首次查询后决定跳转到哪个页面
  useEffect(() => {
    if (!isFetched) return;
    if (currentUser) {
      setCurrentScreen(ScreenId.DISCOVER);
      const initRoute: RouteState = { screen: ScreenId.DISCOVER, characterId: activeCharacterId };
      window.history.replaceState(initRoute, '', window.location.pathname);
    } else {
      setCurrentScreen(ScreenId.WELCOME);
    }
  }, [isFetched, currentUser]);

  const primaryScreens = useMemo(
    () => new Set([ScreenId.DISCOVER, ScreenId.MESSAGE_CENTER, ScreenId.CREATE_CHOICE, ScreenId.PROFILE]),
    [],
  );

  useEffect(() => {
    if (didInitHistory.current) return;
    didInitHistory.current = true;
    window.history.replaceState({ screen: currentScreen, characterId: activeCharacterId }, '', window.location.pathname);

    const onPopState = (event: PopStateEvent) => {
      const nextScreen = event.state?.screen as ScreenId | undefined;
      const nextCharacterId = event.state?.activeCharacterId as string | undefined;
      if (nextCharacterId) setActiveCharacterId(nextCharacterId);
      if (nextScreen && Object.values(ScreenId).includes(nextScreen)) {
        setCurrentScreen(nextScreen);
        trackPageView(nextScreen);
      } else {
        setCurrentScreen(user ? ScreenId.DISCOVER : ScreenId.WELCOME);
        trackPageView(user ? ScreenId.DISCOVER : ScreenId.WELCOME);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeCharacterId, currentScreen, user]);

  // Nav routing switch
  const handleNavigate = useCallback((screen: ScreenId) => {
    setCurrentScreen((previous) => {
      if (previous !== screen) {
        navSourceRef.current = previous ?? ScreenId.DISCOVER;
        setNavigationStack((stack) =>
          primaryScreens.has(screen) ? [] : [...stack, previous as ScreenId]
        );
        window.history.pushState({ screen, characterId: activeCharacterId, source: navSourceRef.current }, '', window.location.pathname);
        // 埋点：页面浏览
        trackPageView(screen);
      }
      return screen;
    });
  }, [activeCharacterId, primaryScreens]);

  const handleGoBack = useCallback((fallback: ScreenId) => {
    const navStack = navigationStack;
    const prevScreen = navStack.length > 0 ? navStack.at(-1) : null;
    const nextScreen = prevScreen || fallback;
    setNavigationStack(navStack.length > 0 ? navStack.slice(0, -1) : []);
    setCurrentScreen(nextScreen);
    window.history.pushState({ screen: nextScreen, characterId: activeCharacterId }, '', window.location.pathname);
  }, [activeCharacterId, navigationStack]);

  const handleLogin = useCallback(async (input: string, password?: string) => {
    const data = await userApi.login({ handle: input, password });
    // 立即填充缓存，避免 user 短暂为 null
    queryClient.setQueryData(['user', 'me'], { handle: data.handle || input, name: data.handle });
    showToast(`欢迎回来，${data.handle || input}！`, 'success');
    // 后台静默刷新最新数据
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
    // 立即填充缓存
    queryClient.setQueryData(['user', 'me'], { handle: username, name: username });
    showToast('注册成功，欢迎加入！', 'success');
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    track('register', { username });
  }, [showToast, userApi, queryClient]);

  const handleLogout = useCallback(() => {
    userApi.logout().catch(() => {});
    track('logout');
    // 重置 React Query 缓存
    queryClient.resetQueries({ queryKey: ['user', 'me'] });
    queryClient.resetQueries({ queryKey: ['favorites', 'list'] });
    setChatThreads({});
    setLoadedChats(new Set());
    // 重置角色列表为种子角色（清除用户创建的角色）
    characterApi.getDiscoverCharacters()
      .then(data => {
        if (Array.isArray(data)) setCharacters(data);
      })
      .catch(() => {});
  }, [characterApi, userApi, queryClient]);

  // Toggle character in favorites — 由 React Query useToggleFavorite hook 处理（含乐观更新 + 回滚）
  const handleToggleFavorite = useCallback((characterId: string) => {
    toggleFavorite(characterId);
    track('toggle_favorite', { character_id: characterId, source: 'button' });
  }, [toggleFavorite]);

  // Publish newly customized cyber persona (or update existing one)
  const handlePublishCharacter = useCallback(async (newChar: Character) => {
    const isEdit = !!editingCharacter;
    if (isEdit) {
      // PNG 角色卡使用 /api/characters/edit，custom_ 角色使用 /api/users/characters/edit
      const isPngCharacter = editingCharacter.id.endsWith('.png');
      if (isPngCharacter) {
        // PNG 角色卡：使用 avatar_url（即 id）更新，后端需要 avatar_url 字段
        await characterApi.updateCharacter({ ...newChar, avatar_url: editingCharacter.id, avatar: editingCharacter.id });
        setCharacters(prev => prev.map(c => c.id === newChar.id ? newChar : c));
      } else {
        const saved = await characterApi.updateUserCharacter(newChar);
        setCharacters(prev => prev.map(c => c.id === saved.id ? saved : c));
      }
      setEditingCharacter(null);
    } else {
      const saved = await characterApi.publishCharacter(newChar);
      setCharacters(prev => [saved, ...prev.filter(c => c.id !== saved.id)]);
      track('create_character', { character_id: saved.id, character_name: saved.name });
    }
  }, [characterApi, editingCharacter]);

  // Append reviews via backend API
  const handleAddReview = useCallback(async (characterId: string, review: Character['reviews'] extends (infer R)[] | undefined ? R : never) => {
    try {
      const updatedChar = await characterApi.addReview(characterId, review);
      setCharacters((prev) =>
        prev.map((c) => (c.id === characterId ? updatedChar : c))
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '评价提交失败';
      showToast(message, 'error');
      throw err;
    }
  }, [characterApi, showToast]);

  // 更新单个角色发送状态
  const setCharacterSendState = useCallback((characterId: string, state: SendState) => {
    sendingStatesRef.current.set(characterId, { state });
    setSendingStates(prev => ({ ...prev, [characterId]: state }));
  }, []);

  // 获取角色发送状态
  const getCharacterSendState = useCallback((characterId: string): SendState => {
    return sendingStatesRef.current.get(characterId)?.state || 'idle';
  }, []);

  // Messaging dispatcher calling backend (streaming SSE) — 带发送队列管理
  const handleSendMessage = useCallback(async (characterId: string, text: string) => {
    // 队列管理：同一角色正在发送时阻止重复发送
    if (getCharacterSendState(characterId) === 'sending' || getCharacterSendState(characterId) === 'streaming') {
      showToast('AI 正在回复中，请等待回复完成后再发送', 'info');
      return;
    }

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const currentThread = chatThreads[characterId] || {
      characterId,
      messages: [],
      unreadCount: 0,
    };

    const updatedThreadMessages = [...currentThread.messages, userMsg];

    // 创建 AI 回复占位消息
    const aiPlaceholderId = 'msg_ai_' + Date.now();
    const aiPlaceholder: ChatMessage = {
      id: aiPlaceholderId,
      role: 'model',
      text: '',
      timestamp: new Date().toISOString(),
    };

    setChatThreads((prev) => ({
      ...prev,
      [characterId]: {
        ...currentThread,
        messages: [...updatedThreadMessages, aiPlaceholder],
      },
    }));

    // 标记发送中
    setCharacterSendState(characterId, 'sending');

    const chatCharacter = characters.find((c) => c.id === characterId) || characters[0];
    if (!chatCharacter) {
      showToast('角色不存在', 'error');
      setCharacterSendState(characterId, 'error');
      return;
    }

    // 用于累积流式文本
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
            // 首次收到 chunk 时切换到 streaming 状态
            if (!streamedText) {
              setCharacterSendState(characterId, 'streaming');
            }
            streamedText += chunk;
            setChatThreads((prev) => {
              const thread = prev[characterId];
              if (!thread) return prev;
              const msgs = [...thread.messages];
              const idx = msgs.findIndex(m => m.id === aiPlaceholderId);
              if (idx >= 0) {
                msgs[idx] = { ...msgs[idx], text: streamedText };
              }
              return { ...prev, [characterId]: { ...thread, messages: msgs } };
            });
          },
          () => {
            // onDone — 保存完整聊天到后端
            const finalMessages = [
              ...updatedThreadMessages,
              { ...aiPlaceholder, text: streamedText || '……发生连接断裂。' },
            ];
            chatApi.saveChat(characterId, toStoredChatMessages(chatCharacter, finalMessages)).catch(() => {});
            // 同步更新 IndexedDB 离线缓存
            cacheMessages(characterId, [
              ...updatedThreadMessages,
              { ...aiPlaceholder, text: streamedText || '' },
            ]);
            setCharacterSendState(characterId, 'idle');
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
            setChatThreads((prev) => ({
              ...prev,
              [characterId]: {
                ...prev[characterId],
                messages: [...updatedThreadMessages, errorMsg],
              },
            }));
            setCharacterSendState(characterId, 'error');
            reject(err);
          },
        );
      });
    } catch {
      // sendMessageStream 同步抛出时的兜底处理
      setCharacterSendState(characterId, 'error');
    }
  }, [chatApi, chatThreads, characters, showToast, setCharacterSendState, getCharacterSendState]);

  // 删除角色
  const handleDeleteCharacter = useCallback(async (characterId: string) => {
    const char = characters.find(c => c.id === characterId);
    if (!char) return;
    try {
      if (char.id.startsWith('custom_')) {
        await characterApi.deleteUserCharacter(characterId);
      } else if (char.id.endsWith('.png')) {
        // PNG 角色卡：avatar_url 就是文件名（即 id）
        await characterApi.deleteCharacter(char.id);
      } else {
        await characterApi.deleteCharacter(char.avatar);
      }
      setCharacters(prev => prev.filter(c => c.id !== characterId));
      showToast('角色已删除', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败';
      showToast(message, 'error');
    }
  }, [characterApi, characters, showToast]);

  // 加载聊天线程（匿名用户时加载）
  useEffect(() => {
    if (!isFetched || currentUser) return; // 等 React Query 确认未登录
    chatApi.getThreads()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChatThreads(prev => {
            const merged = { ...prev };
            for (const thread of data) {
              if (!merged[thread.characterId]) {
                merged[thread.characterId] = {
                  ...thread,
                  messages: thread.messages || [],
                  unreadCount: thread.unreadCount || 0,
                };
              }
            }
            return merged;
          });
          // 缓存线程列表到 IndexedDB
          cacheThreads(data as any);
        }
      })
      .catch(() => {});
  }, [isFetched, currentUser, chatApi]);
  useEffect(() => {
    if (!currentUser) return;
    setChatThreads({});
    Promise.all([
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
      chatApi.getThreads().catch(() => []),
    ])    .then(([charsData, pngCharsData, threadsData]) => {
      const mergeChars = (data: Character[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newChars = data.filter((c: Character) => !existingIds.has(c.id));
            return [...prev, ...newChars];
          });
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
        setChatThreads(threads);
        // 缓存线程到 IndexedDB
        cacheThreads(threadsData as any);
      }
    })
    .catch(() => {
      // 网络失败时从 IndexedDB 加载缓存线程
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
          setChatThreads(threads);
        }
      });
    });
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // 进入聊天时加载已有聊天记录（避免重复加载）— 在线时从 API，离线时从 IndexedDB
  const [loadedChats, setLoadedChats] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (currentScreen !== ScreenId.CHAT || !activeCharacterId) return;
    if (loadedChats.has(activeCharacterId)) return;
    setLoadedChats(prev => new Set(prev).add(activeCharacterId));
    chatApi.getChat(activeCharacterId)
      .then(data => {
        const messages = fromStoredChatMessages(data);
        if (messages.length > 0) {
          setChatThreads(prev => ({
            ...prev,
            [activeCharacterId]: {
              ...prev[activeCharacterId],
              characterId: activeCharacterId,
              messages,
              unreadCount: 0,
            },
          }));
          // 在线时更新 IndexedDB 缓存
          cacheMessages(activeCharacterId, messages);
        }
      })
      .catch(() => {
        // API 失败时尝试从 IndexedDB 加载离线缓存
        getCachedMessages(activeCharacterId).then(cached => {
          if (cached.length > 0) {
            setChatThreads(prev => ({
              ...prev,
              [activeCharacterId]: {
                ...prev[activeCharacterId],
                characterId: activeCharacterId,
                messages: cached,
                unreadCount: 0,
              },
            }));
          }
        });
      });
  }, [chatApi, currentScreen, activeCharacterId, loadedChats]);

  const currentCharacter = characters.find((c) => c.id === activeCharacterId) || characters[0] || null;

  // Memoize myCharactersCount to avoid recalculation on every render
  const myCharactersCount = useMemo(() => characters.filter(c => c.id.startsWith('custom_') || c.id.endsWith('.png')).length, [characters]);

  const requiresCharacter = currentScreen !== null && [
    ScreenId.DISCOVER,
    ScreenId.CHARACTER_DETAIL,
    ScreenId.CHAT,
    ScreenId.MESSAGE_CENTER,
    ScreenId.MY_CHARACTERS,
    ScreenId.MY_FAVORITES,
  ].includes(currentScreen);

  // Splash Screen — 品牌启动画面
  if (!splashComplete) {
    return (
      <SplashScreen
        ready={currentScreen !== null && isFetched}
        onComplete={handleSplashComplete}
      />
    );
  }

  // React Query 尚未完成首次查询 — 显示加载（Splash完成后，极端情况兜底）
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

  if (!currentCharacter && requiresCharacter) {
    return (
      <div className="h-dvh w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔄</div>
          <p className="text-sm text-on-surface-variant">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full bg-[#090A0F] text-[#E0E0E6] flex flex-col justify-self-center overflow-hidden max-w-lg mx-auto shadow-[0_0_80px_rgba(9,10,15,0.95)] border-x border-white/5 relative safe-top" style={{ WebkitOverflowScrolling: 'touch' }}>
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="h-full w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center"><div className="text-center space-y-4"><div className="text-4xl">🔄</div><p className="text-sm text-on-surface-variant">加载中...</p></div></div>}>
        <div
          key={currentScreen}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          {currentScreen === ScreenId.WELCOME && (
            <WelcomeScreen onNavigate={handleNavigate} onGoogleLogin={handleGoogleLogin} />
          )}

          {currentScreen === ScreenId.EMAIL_LOGIN && (
            <LoginScreen onNavigate={handleNavigate} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />
          )}

          {currentScreen === ScreenId.REGISTER && (
            <RegisterScreen onNavigate={handleNavigate} onRegister={handleRegister} onGoogleLogin={handleGoogleLogin} />
          )}

          {currentScreen === ScreenId.FORGOT_PASSWORD && (
            <ForgotPasswordScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === ScreenId.RESET_PASSWORD && (
            <ResetPasswordScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === ScreenId.DISCOVER && (
            <DiscoverScreen
              characters={characters}
              favoriteIds={favoriteIds as string[]}
              onNavigate={handleNavigate}
              onSelectCharacter={(id) => {
                setActiveCharacterId(id);
                if (chatThreads[id]) {
                  setChatThreads(prev => ({
                    ...prev,
                    [id]: { ...prev[id], unreadCount: 0 }
                  }));
                }
              }}
              toggleFavorite={handleToggleFavorite}
            />
          )}

          {currentScreen === ScreenId.CHARACTER_DETAIL && (
            <CharacterDetailScreen
              character={currentCharacter as Character}
              userHandle={user?.username}
              favoriteIds={favoriteIds as string[]}
              toggleFavorite={handleToggleFavorite}
              onNavigate={handleNavigate}
              onGoBack={() => handleGoBack(ScreenId.DISCOVER)}
              onSelectCharacter={setActiveCharacterId}
              onAddReview={handleAddReview}
            />
          )}

          {currentScreen === ScreenId.CHAT && (
            <ChatScreen
              character={currentCharacter as Character}
              messages={chatThreads[activeCharacterId]?.messages || []}
              onSendMessage={handleSendMessage}
              onNavigate={handleNavigate}
              onGoBack={() => handleGoBack(ScreenId.MESSAGE_CENTER)}
              sendState={sendingStates[activeCharacterId] || 'idle'}
            />
          )}

          {currentScreen === ScreenId.CREATE_CHOICE && (
            <CreateChoiceScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === ScreenId.CREATE_CHARACTER && (
            <CreateCharacterScreen
              onNavigate={(screen) => { setEditingCharacter(null); handleNavigate(screen); }}
              onGoBack={() => handleGoBack(ScreenId.MY_CHARACTERS)}
              onPublish={handlePublishCharacter}
              editCharacter={editingCharacter}
            />
          )}

          {currentScreen === ScreenId.MESSAGE_CENTER && (
            <MessageCenterScreen
              characters={characters}
              chatThreads={chatThreads}
              onNavigate={handleNavigate}
              onSelectCharacter={setActiveCharacterId}
              onDeleteChatThreads={(characterIds) => {
                setChatThreads(prev => {
                  const next = { ...prev };
                  for (const id of characterIds) {
                    delete next[id];
                  }
                  return next;
                });
              }}
              onTogglePinChat={(characterId, pinned) => {
                setChatThreads(prev => ({
                  ...prev,
                  [characterId]: {
                    ...prev[characterId],
                    pinned,
                  },
                }));
              }}
            />
          )}

          {currentScreen === ScreenId.PROFILE && (
            <ProfileScreen
              user={user}
              favoriteCount={(favoriteIds as string[]).length}
              myCharactersCount={myCharactersCount}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
            />
          )}

          {currentScreen === ScreenId.MY_CHARACTERS && (
            <MyCharactersScreen
              characters={characters}
              onNavigate={handleNavigate}
              onSelectCharacter={setActiveCharacterId}
              onEditCharacter={(char) => setEditingCharacter(char)}
              onDeleteCharacter={handleDeleteCharacter}
              currentUser={user?.username || ''}
            />
          )}

          {currentScreen === ScreenId.MY_FAVORITES && (
            <MyFavoritesScreen
              characters={characters}
              favoriteIds={favoriteIds as string[]}
              onNavigate={handleNavigate}
              onSelectCharacter={setActiveCharacterId}
              toggleFavorite={handleToggleFavorite}
            />
          )}

          {currentScreen === ScreenId.SETTINGS && (
            <SettingsScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === ScreenId.HELP_FEEDBACK && (
            <HelpFeedbackScreen faqs={FAQS} onNavigate={handleNavigate} />
          )}
        </div>
        </Suspense>
      </AnimatePresence>
    </div>
  );
}
