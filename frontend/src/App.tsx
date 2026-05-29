import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId, Character, ChatThread, ChatMessage } from './types';
import { FAQS } from './data';
import { useToast } from './components/Toast.tsx';

// Import our modular screens
import GoogleCallback from './components/GoogleCallback';
import WelcomeScreen from './components/WelcomeScreen';
import EmailLoginScreen from './components/EmailLoginScreen';
import RegisterScreen from './components/RegisterScreen';
import DiscoverScreen from './components/DiscoverScreen';
import CharacterDetailScreen from './components/CharacterDetailScreen';
import ChatScreen from './components/ChatScreen';
import CreateChoiceScreen from './components/CreateChoiceScreen';
import CreateCharacterScreen from './components/CreateCharacterScreen';
import MessageCenterScreen from './components/MessageCenterScreen';
import ProfileScreen from './components/ProfileScreen';
import MyCharactersScreen from './components/MyCharactersScreen';
import MyFavoritesScreen from './components/MyFavoritesScreen';
import SettingsScreen from './components/SettingsScreen';
import HelpFeedbackScreen from './components/HelpFeedbackScreen';

export default function App() {
  // Google OAuth 回调路由 — 弹窗中独立渲染
  if (window.location.pathname === '/auth/google/callback') {
    return <GoogleCallback />;
  }

  const [currentScreen, setCurrentScreen] = useState<ScreenId>(ScreenId.WELCOME);
  const [activeCharacterId, setActiveCharacterId] = useState<string>('yuki');
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [user, setUser] = useState<{ username: string; email: string } | null>(null);

  // Dynamic state arrays
  const [characters, setCharacters] = useState<Character[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [chatThreads, setChatThreads] = useState<Record<string, ChatThread>>({});
  const { showToast } = useToast();

  // 从后端加载数据
  useEffect(() => {
    // 种子角色
    fetch('/api/discover')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setCharacters(data);
      })
      .catch(() => {});

    // 收藏
    fetch('/api/users/favorites')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.favorites)) setFavoriteIds(data.favorites);
      })
      .catch(() => {});

    // 用户角色
    fetch('/api/users/characters')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newChars = data.filter((c: Character) => !existingIds.has(c.id));
            return [...prev, ...newChars];
          });
        }
      })
      .catch(() => {});
  }, []);

  // Nav routing switch
  const handleNavigate = useCallback((screen: ScreenId) => {
    setCurrentScreen(screen);
  }, []);

  const handleLogin = useCallback(async (input: string, password?: string) => {
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: input, password }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Login failed');
      }
      const data = await res.json();
      setUser({
        username: data.handle || input,
        email: input.includes('@') ? input : `${data.handle}@yuzu.ai`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`登录失败: ${message}，以离线模式进入`, 'error');
      const displayName = input.includes('@') ? input.split('@')[0] : input;
      setUser({
        username: displayName || '特工_Pilot',
        email: input.includes('@') ? input : `${displayName}@yuzu.ai`,
      });
    }
  }, [showToast]);

  // Google OAuth 登录
  const handleGoogleLogin = useCallback(async (idToken: string) => {
    try {
      const res = await fetch('/api/users/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || err.error || 'Google login failed');
      }
      const data = await res.json();
      setUser({
        username: data.handle,
        email: `${data.handle}@yuzu.ai`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`Google 登录失败: ${message}`, 'error');
    }
  }, [showToast]);

  const handleRegister = useCallback(async (username: string, email: string, password?: string) => {
    try {
      const res = await fetch('/api/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: username, name: username, password, email }),
      });
      if (res.ok) {
        setUser({ username, email });
        setCurrentScreen(ScreenId.DISCOVER);
      }
    } catch {
      // Fallback
      setUser({ username, email });
    }
  }, []);

  const handleLogout = useCallback(() => {
    fetch('/api/users/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setFavoriteIds([]);
    setChatThreads({});
    // 重置角色列表为种子角色（清除用户创建的角色）
    fetch('/api/discover')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCharacters(data);
      })
      .catch(() => {});
  }, []);

  // Toggle character in favorites
  const handleToggleFavorite = useCallback(async (characterId: string) => {
    const isFav = favoriteIds.includes(characterId);
    // 乐观更新 UI
    setFavoriteIds(isFav
      ? favoriteIds.filter((id) => id !== characterId)
      : [...favoriteIds, characterId]
    );
    try {
      if (isFav) {
        await fetch(`/api/users/favorites/${characterId}`, { method: 'DELETE' });
      } else {
        await fetch('/api/users/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ characterId }),
        });
      }
    } catch {
      // 回滚
      setFavoriteIds(isFav
        ? [...favoriteIds, characterId]
        : favoriteIds.filter((id) => id !== characterId)
      );
    }
  }, [favoriteIds]);

  // Publish newly customized cyber persona (or update existing one)
  const handlePublishCharacter = useCallback(async (newChar: Character) => {
    const isEdit = !!editingCharacter;
    try {
      if (isEdit) {
        // Update existing character
        const res = await fetch('/api/characters/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar_url: newChar.id, ...newChar }),
        });
        if (res.ok) {
          setCharacters(prev => prev.map(c => c.id === newChar.id ? newChar : c));
          setEditingCharacter(null);
          return;
        }
      } else {
        // Create new character
        const res = await fetch('/api/characters/publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newChar),
        });
        if (res.ok) {
          const saved = await res.json();
          setCharacters(prev => [saved, ...prev]);
          return;
        }
      }
    } catch { /* fallback below */ }
    // fallback
    if (isEdit) {
      setCharacters(prev => prev.map(c => c.id === newChar.id ? newChar : c));
      setEditingCharacter(null);
    } else {
      setCharacters(prev => [newChar, ...prev]);
    }
  }, [editingCharacter]);

  // Append reviews via backend API
  const handleAddReview = useCallback(async (characterId: string, review: Character['reviews'] extends (infer R)[] | undefined ? R : never) => {
    try {
      const res = await fetch(`/api/discover/${characterId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(review),
      });
      if (res.ok) {
        const updatedChar = await res.json();
        setCharacters((prev) =>
          prev.map((c) => (c.id === characterId ? updatedChar : c))
        );
        return;
      }
    } catch { /* fallback below */ }
    // Fallback: 本地更新
    setCharacters((prev) =>
      prev.map((c) => {
        if (c.id === characterId) {
          const currentReviews = c.reviews || [];
          const updatedReviews = [review, ...currentReviews];
          const average = parseFloat(
            (updatedReviews.reduce((sum, r) => sum + r.rating, 0) / updatedReviews.length).toFixed(1)
          );
          return { ...c, reviews: updatedReviews, reviewCount: updatedReviews.length, rating: average };
        }
        return c;
      })
    );
  }, []);

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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: updatedThreadMessages.map((m) => ({ role: m.role, text: m.text })),
          characterName: chatCharacter.name,
          characterDescription: chatCharacter.description,
          worldBook: chatCharacter.worldBook,
        }),
      });

      const data = await response.json();

      const aiReply: ChatMessage = {
        id: 'msg_ai_' + Date.now(),
        role: 'model',
        text: data.text || '……发生连接断裂。',
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

      // 保存聊天到后端
      fetch('/api/chats/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatar_url: characterId,
          file_name: 'chat',
          chat: finalMessages,
        }),
      }).catch(() => {});
    } catch {
      showToast('消息发送失败，请检查网络连接', 'error');
      const errorMsg: ChatMessage = {
        id: 'msg_err_' + Date.now(),
        role: 'model',
        text: '（⚠️ 脑干链接断开，网络发生干扰。请重试……）',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatThreads((prev) => ({
        ...prev,
        [characterId]: {
          ...currentThread,
          messages: [...updatedThreadMessages, errorMsg],
        },
      }));
    }
  }, [chatThreads, characters, showToast]);

  // 删除角色
  const handleDeleteCharacter = useCallback(async (characterId: string) => {
    const char = characters.find(c => c.id === characterId);
    if (!char) return;
    try {
      const res = await fetch('/api/characters/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: char.avatar }),
      });
      if (res.ok) {
        setCharacters(prev => prev.filter(c => c.id !== characterId));
        showToast('角色已删除', 'success');
      }
    } catch {
      showToast('删除失败', 'error');
    }
  }, [characters, showToast]);

  // 加载聊天线程（仅在挂载和无用户时加载）
  useEffect(() => {
    if (user) return;
    fetch('/api/chat/threads')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChatThreads(prev => {
            const merged = { ...prev };
            if (Array.isArray(data)) {
              for (const thread of data) {
                if (!merged[thread.characterId]) {
                  merged[thread.characterId] = thread;
                }
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, [user]);

  // 用户登录/登出时重新加载个人数据
  useEffect(() => {
    if (!user) return;
    fetch('/api/users/favorites')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.favorites)) setFavoriteIds(data.favorites);
      })
      .catch(() => {});
    fetch('/api/users/characters')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setCharacters(prev => {
            const existingIds = new Set(prev.map(c => c.id));
            const newChars = data.filter((c: Character) => !existingIds.has(c.id));
            return [...prev, ...newChars];
          });
        }
      })
      .catch(() => {});
    // 先清空旧数据，再加载当前用户的数据
    setChatThreads({});
    fetch('/api/chat/threads')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const threads: Record<string, ChatThread> = {};
          for (const thread of data) {
            threads[thread.characterId] = thread;
          }
          setChatThreads(threads);
        }
      })
      .catch(() => {});
  }, [user]);

  // 进入聊天时加载已有聊天记录
  useEffect(() => {
    if (currentScreen !== ScreenId.CHAT || !activeCharacterId) return;
    fetch('/api/chats/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_url: activeCharacterId, file_name: 'chat' }),
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setChatThreads(prev => ({
            ...prev,
            [activeCharacterId]: {
              characterId: activeCharacterId,
              messages: data,
              unreadCount: 0,
            },
          }));
        }
      })
      .catch(() => {});
  }, [currentScreen, activeCharacterId]);

  const currentCharacter = characters.find((c) => c.id === activeCharacterId) || characters[0] || null;

  if (!currentCharacter) {
    return (
      <div className="min-h-screen w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-4xl">🔄</div>
          <p className="text-sm text-on-surface-variant">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#090A0F] text-[#E0E0E6] flex flex-col justify-self-center overflow-x-hidden max-w-lg mx-auto shadow-[0_0_80px_rgba(9,10,15,0.95)] border-x border-white/5 relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex-grow flex flex-col"
        >
          {currentScreen === ScreenId.WELCOME && (
            <WelcomeScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === ScreenId.EMAIL_LOGIN && (
            <EmailLoginScreen onNavigate={handleNavigate} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />
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
              character={currentCharacter}
              favoriteIds={favoriteIds}
              toggleFavorite={handleToggleFavorite}
              onNavigate={handleNavigate}
              onSelectCharacter={setActiveCharacterId}
              onAddReview={handleAddReview}
            />
          )}

          {currentScreen === ScreenId.CHAT && (
            <ChatScreen
              character={currentCharacter}
              messages={chatThreads[activeCharacterId]?.messages || []}
              onSendMessage={handleSendMessage}
              onNavigate={handleNavigate}
            />
          )}

          {currentScreen === ScreenId.CREATE_CHOICE && (
            <CreateChoiceScreen onNavigate={handleNavigate} />
          )}

          {currentScreen === ScreenId.CREATE_CHARACTER && (
            <CreateCharacterScreen
              onNavigate={(screen) => { setEditingCharacter(null); handleNavigate(screen); }}
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
            />
          )}

          {currentScreen === ScreenId.PROFILE && (
            <ProfileScreen
              user={user}
              favoriteCount={favoriteIds.length}
              myCharactersCount={characters.filter(c => c.id.startsWith('custom_')).length}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
