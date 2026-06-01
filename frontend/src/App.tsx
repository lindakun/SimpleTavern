import { useState, useEffect, useCallback, lazy, Suspense, useMemo, useRef } from 'react';
import { AnimatePresence } from 'motion/react';
import { ScreenId, Character, ChatThread, ChatMessage, RouteState } from './types';
import { FAQS } from './data';
import { useToast } from './components/Toast.tsx';
import { registerServiceWorker } from './sw-register';
import { useUserApi } from './api/users';
import { useCharacterApi } from './api/characters';
import { useChatApi } from './api/chat';
import { fromStoredChatMessages, toStoredChatMessages } from './utils/chatMessages';

// Import our modular screens — lazy loaded for code splitting
import GoogleCallback from './components/GoogleCallback';
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

export default function App() {
  // 注册 Service Worker（生产环境）
  useEffect(() => { registerServiceWorker(); }, []);

  // Google OAuth 回调路由 — 弹窗中独立渲染
  if (window.location.pathname === '/auth/google/callback') {
    return <GoogleCallback />;
  }

  const [currentScreen, setCurrentScreen] = useState<ScreenId>(ScreenId.WELCOME);
  const [navigationStack, setNavigationStack] = useState<ScreenId[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState<string>('yuki');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);

  // Dynamic state arrays
  const [characters, setCharacters] = useState<Character[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const { showToast } = useToast();
  const userApi = useUserApi();
  const characterApi = useCharacterApi();
  const chatApi = useChatApi();
  const didInitHistory = useRef(false);
  const navSourceRef = useRef<ScreenId>(ScreenId.DISCOVER);

  const hydrateUser = useCallback(async () => {
    const profile = await userApi.getMe();
    setUser({
      username: profile.handle,
      email: `${profile.handle}@yuzu.ai`,
    });
    return profile;
  }, [userApi]);

  // 从后端加载数据（并行请求）
  useEffect(() => {
    Promise.all([
      characterApi.getDiscoverCharacters().catch(() => []),
      userApi.getFavorites().catch(() => ({ favorites: [] })),
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
    ]).then(([discoverData, favData, charsData, pngCharsData]) => {
      if (Array.isArray(discoverData) && discoverData.length > 0) setCharacters(discoverData);
      if (favData && Array.isArray(favData.favorites)) setFavoriteIds(favData.favorites);
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

  // 恢复 cookie-session：刷新页面或新标签打开时保持登录态
  useEffect(() => {
    hydrateUser()
      .then(() => {
        setCurrentScreen(ScreenId.DISCOVER);
        const initRoute: RouteState = { screen: ScreenId.DISCOVER, characterId: activeCharacterId };
  window.history.replaceState(initRoute, '', window.location.pathname);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

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
      } else {
        setCurrentScreen(user ? ScreenId.DISCOVER : ScreenId.WELCOME);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [activeCharacterId, currentScreen, user]);

  // Nav routing switch
  const handleNavigate = useCallback((screen: ScreenId) => {
    setCurrentScreen((previous) => {
      if (previous !== screen) {
        navSourceRef.current = previous;
        setNavigationStack((stack) =>
          primaryScreens.has(screen) ? [] : [...stack, previous]
        );
        window.history.pushState({ screen, characterId: activeCharacterId, source: navSourceRef.current }, '', window.location.pathname);
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
    setUser({
      username: data.handle || input,
      email: input.includes('@') ? input : `${data.handle}@yuzu.ai`,
    });
    showToast(`欢迎回来，${data.handle}！`, 'success');
  }, [showToast, userApi]);

  // Google OAuth 登录
  const handleGoogleLogin = useCallback(async (idToken: string) => {
    try {
      await userApi.googleLogin(idToken);
      await hydrateUser();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`Google 登录失败: ${message}`, 'error');
      throw err;
    }
  }, [hydrateUser, showToast, userApi]);

  const handleRegister = useCallback(async (username: string, email: string, password?: string) => {
    await userApi.register({ handle: username, name: username, password, email });
    await hydrateUser();
    showToast('注册成功，欢迎加入！', 'success');
  }, [hydrateUser, showToast, userApi]);

  const handleLogout = useCallback(() => {
    userApi.logout().catch(() => {});
    setUser(null);
    setFavoriteIds([]);
    setChatThreads({});
    // 重置角色列表为种子角色（清除用户创建的角色）
    characterApi.getDiscoverCharacters()
      .then(data => {
        if (Array.isArray(data)) setCharacters(data);
      })
      .catch(() => {});
  }, [characterApi, userApi]);

  // Toggle character in favorites — uses functional setState to avoid favoriteIds dependency
  const handleToggleFavorite = useCallback(async (characterId: string) => {
    const wasFav = favoriteIds.includes(characterId);
    // 乐观更新 UI（用 functional setState 读取最新状态）
    setFavoriteIds(prev =>
      wasFav
        ? prev.filter((id) => id !== characterId)
        : [...prev, characterId]
    );
    try {
      if (wasFav) {
        await userApi.removeFavorite(characterId);
      } else {
        await userApi.addFavorite(characterId);
      }
    } catch (err: unknown) {
      // 回滚
      setFavoriteIds(prev =>
        wasFav
          ? [...prev, characterId]
          : prev.filter((id) => id !== characterId)
      );
      const message = err instanceof Error ? err.message : '收藏同步失败';
      showToast(message, 'error');
    }
  }, [favoriteIds, showToast, userApi]);

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

  // Messaging dispatcher calling backend
  const handleSendMessage = useCallback(async (characterId: string, text: string) => {
    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentThread = chatThreads[characterId] || {
      characterId,
      messages: [],
      unreadCount: 0,
    };

    const updatedThreadMessages = [...currentThread.messages, userMsg];

    setChatThreads((prev) => ({
      ...prev,
      [characterId]: {
        ...currentThread,
        messages: updatedThreadMessages,
      },
    }));

    const chatCharacter = characters.find((c) => c.id === characterId) || characters[0];
    if (!chatCharacter) {
      showToast('角色不存在', 'error');
      return;
    }

    try {
      const response = await chatApi.sendMessage({
        message: text,
        history: currentThread.messages.map((m) => ({ role: m.role, text: m.text })),
        characterName: chatCharacter.name,
        characterDescription: chatCharacter.description,
        // V3 角色卡字段
        personality: chatCharacter.personality,
        scenario: chatCharacter.scenario,
        first_mes: chatCharacter.first_mes,
        mes_example: chatCharacter.mes_example,
        system_prompt: chatCharacter.system_prompt,
        post_history_instructions: chatCharacter.post_history_instructions,
        alternate_greetings: chatCharacter.alternate_greetings,
        // 兼容旧字段
        worldBook: chatCharacter.worldBook,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const aiReply: ChatMessage = {
        id: 'msg_ai_' + Date.now(),
        role: 'model',
        text: response.text || '……发生连接断裂。',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const finalMessages = [...updatedThreadMessages, aiReply];

      setChatThreads((prev) => ({
        ...prev,
        [characterId]: {
          ...currentThread,
          messages: finalMessages,
        },
      }));

      await chatApi.saveChat(characterId, toStoredChatMessages(chatCharacter, finalMessages));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '消息发送失败，请检查网络连接';
      showToast(`消息发送失败: ${message}`, 'error');
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'model',
        text: `（发送失败：${message}）`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatThreads((prev) => ({
        ...prev,
        [characterId]: {
          ...currentThread,
          messages: [...updatedThreadMessages, errorMsg],
        },
      }));
      throw err;
    }
  }, [chatApi, chatThreads, characters, showToast]);

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

  // 加载聊天线程（仅在挂载和无用户时加载）
  useEffect(() => {
    if (user) return;
    chatApi.getThreads()
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChatThreads(prev => {
            const merged = { ...prev };
            if (Array.isArray(data)) {
              for (const thread of data) {
                if (!merged[thread.characterId]) {
                  merged[thread.characterId] = {
                    ...thread,
                    messages: thread.messages || [],
                    unreadCount: thread.unreadCount || 0,
                  };
                }
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 用户登录/登出时重新加载个人数据（并行请求）
  useEffect(() => {
    if (!user) return;
    setChatThreads({});
    Promise.all([
      userApi.getFavorites().catch(() => ({ favorites: [] })),
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
      chatApi.getThreads().catch(() => []),
    ]).then(([favData, charsData, pngCharsData, threadsData]) => {
      if (favData && Array.isArray(favData.favorites)) setFavoriteIds(favData.favorites);
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
      }
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // 进入聊天时加载已有聊天记录（避免重复加载）
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
        }
      })
      .catch(() => {});
  }, [chatApi, currentScreen, activeCharacterId, loadedChats]);

  const currentCharacter = characters.find((c) => c.id === activeCharacterId) || characters[0] || null;

  // Memoize myCharactersCount to avoid recalculation on every render
  const myCharactersCount = useMemo(() => characters.filter(c => c.id.startsWith('custom_') || c.id.endsWith('.png')).length, [characters]);

  const requiresCharacter = [
    ScreenId.DISCOVER,
    ScreenId.CHARACTER_DETAIL,
    ScreenId.CHAT,
    ScreenId.MESSAGE_CENTER,
    ScreenId.MY_CHARACTERS,
    ScreenId.MY_FAVORITES,
  ].includes(currentScreen);

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
    <div className="h-dvh w-full bg-[#090A0F] text-[#E0E0E6] flex flex-col justify-self-center overflow-x-hidden max-w-lg mx-auto shadow-[0_0_80px_rgba(9,10,15,0.95)] border-x border-white/5 relative">
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="h-full w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center"><div className="text-center space-y-4"><div className="text-4xl">🔄</div><p className="text-sm text-on-surface-variant">加载中...</p></div></div>}>
        <div
          key={currentScreen}
          className="flex-1 flex flex-col min-h-0"
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

          {currentScreen === ScreenId.DISCOVER && (
            <DiscoverScreen
              characters={characters}
              favoriteIds={favoriteIds}
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
              favoriteIds={favoriteIds}
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
              favoriteCount={favoriteIds.length}
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
              favoriteIds={favoriteIds}
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
