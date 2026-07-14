import { lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ScreenId } from './types';
import type { Character, ChatThread, SendState } from './types';
import { FAQS } from './data';

// Lazy-loaded screens
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
export const SCREEN_PATHS: Record<ScreenId, string> = {
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

export const pathToScreen = (path: string): ScreenId | null => {
  for (const [screen, p] of Object.entries(SCREEN_PATHS)) {
    if (path === p || path.startsWith(p + '/')) return screen as ScreenId;
  }
  return null;
};

// ── Props interface for AppRoutes ──
export interface AppRoutesProps {
  // Auth handlers
  handleLogin: (input: string, password?: string) => Promise<void>;
  handleRegister: (username: string, email: string, password?: string) => Promise<void>;
  handleGoogleLogin: (idToken: string) => Promise<void>;
  handleLogout: () => Promise<void>;
  // Navigation
  handleNavigate: (screen: ScreenId) => void;
  handleGoBack: (fallback: ScreenId) => void;
  // Character state
  characters: Character[];
  publicCharacters: Character[];
  userCharacters: Character[];
  user: { username: string; email: string } | null;
  currentUserHandle: string | undefined;
  currentCharacter: Character | null;
  editingCharacter: Character | null;
  setEditingCharacter: (c: Character | null) => void;
  // Favorites
  favoriteIds: string[];
  handleToggleFavorite: (characterId: string) => void;
  // Character ops
  handlePublishCharacter: (newChar: Character) => Promise<void>;
  handleAddReview: (characterId: string, review: Character['reviews'] extends (infer R)[] | undefined ? R : never) => Promise<void>;
  handleUpdatePrivacy: (characterId: string, privacyType: 'public' | 'private') => Promise<void>;
  handleCopyCharacter: (character: Character) => Promise<void>;
  handleDeleteCharacter: (characterId: string) => Promise<void>;
  // Chat state
  chatThreads: Record<string, ChatThread>;
  sendingStates: Record<string, SendState>;
  activeCharacterId: string;
  setActiveCharacterId: (id: string) => void;
  handleSendMessage: (characterId: string, text: string) => Promise<void>;
  handleDeleteMessage: (characterId: string, msgId: string) => void;
  handleStopGeneration: (characterId: string) => void;
  handleEditMessage: (characterId: string, messageId: string, newText: string) => void;
  handleRegenerateMessage: (characterId: string, messageId: string) => void;
  handleNewChat: (characterId: string, greetingIndex?: number) => void;
  deleteChatThreads: (characterIds: string[]) => void;
  updateChatThread: (characterId: string, updater: (thread: ChatThread) => ChatThread) => void;
  clearUnreadCount: (characterId: string) => void;
  // Misc
  locationPathname: string;
  myCharactersCount: number;
  characterApiRefresh: () => Promise<void>;
}

export default function AppRoutes(props: AppRoutesProps) {
  const {
    handleLogin, handleRegister, handleGoogleLogin, handleLogout,
    handleNavigate, handleGoBack,
    publicCharacters, characters, userCharacters,
    user, currentCharacter, editingCharacter, setEditingCharacter,
    favoriteIds, handleToggleFavorite,
    handlePublishCharacter, handleAddReview, handleUpdatePrivacy,
    handleCopyCharacter, handleDeleteCharacter,
    chatThreads, sendingStates,
    activeCharacterId, setActiveCharacterId,
    handleSendMessage, handleDeleteMessage, handleStopGeneration, handleEditMessage,
    handleRegenerateMessage, handleNewChat,
    deleteChatThreads, updateChatThread,
    clearUnreadCount,
    locationPathname, myCharactersCount, characterApiRefresh,
  } = props;

  return (
    <Routes>
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
            clearUnreadCount(id);
          }}
          toggleFavorite={handleToggleFavorite}
          onRefresh={characterApiRefresh}
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
      <Route path="/character/:id" element={
        (() => {
          const idFromPath = decodeURIComponent(locationPathname.split('/character/')[1] || '');
          const char = characters.find(c => c.id === idFromPath);
          if (char) {
            return (
              <CharacterDetailScreen
                character={char as Character}
                userHandle={user?.username}
                favoriteIds={favoriteIds as string[]}
                toggleFavorite={handleToggleFavorite}
                onNavigate={handleNavigate}
                onGoBack={() => handleGoBack(ScreenId.DISCOVER)}
                onSelectCharacter={setActiveCharacterId}
                onAddReview={handleAddReview}
                onCopyCharacter={handleCopyCharacter}
              />
            );
          }
          return (
            <div className="flex-1 flex items-center justify-center bg-background-deep text-on-surface-variant">
              <div className="text-center space-y-3">
                <span className="text-4xl">🔍</span>
                <p className="text-sm">角色不存在或已被删除</p>
                <button onClick={() => handleNavigate(ScreenId.DISCOVER)} className="text-xs text-accent-pink hover:text-white border border-accent-pink/40 rounded-xl px-4 py-2 cursor-pointer">返回发现页</button>
              </div>
            </div>
          );
        })()
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
            userHandle={user?.username}
            onStopGeneration={() => handleStopGeneration(activeCharacterId)}
            onEditMessage={handleEditMessage}
            onRegenerateMessage={handleRegenerateMessage}
            onNewChat={handleNewChat}
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
  );
}
