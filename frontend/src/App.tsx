import { Suspense, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import SplashScreen from './components/SplashScreen';
import AppRoutes from './routes';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useCharacterManagement } from './hooks/useCharacterManagement';
import { useChatFlow } from './hooks/useChatFlow';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentScreen, isFetched, user,
    splashComplete, handleSplashComplete,
    handleNavigate, handleGoBack,
  } = useAppNavigation();

  const {
    characters, editingCharacter, setEditingCharacter,
    favoriteIds,
    handleLogin, handleGoogleLogin, handleRegister,
    handleLogout,
    handleToggleFavorite, handlePublishCharacter, handleAddReview,
    handleUpdatePrivacy, handleCopyCharacter, handleDeleteCharacter,
    characterApiRefresh,
  } = useCharacterManagement(navigate);

  const {
    activeCharacterId, setActiveCharacterId,
    chatThreads, sendingStates,
    updateChatThread, deleteChatThreads,
    clearUnreadCount,
    handleSendMessage, handleStopGeneration,
    handleEditMessage, handleDeleteMessage,
  } = useChatFlow(currentScreen);

  // ── Computed values ──
  const currentCharacter = characters.find((c) => c.id === activeCharacterId) || characters[0] || null;
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

  const myCharactersCount = useMemo(() => userCharacters.length, [userCharacters]);

  const publicCharacters = useMemo(
    () => characters.filter(c => c.privacyType !== 'private'),
    [characters],
  );

  // ── Splash Screen ──
  if (!splashComplete) {
    return (
      <SplashScreen
        ready={currentScreen !== null && isFetched}
        onComplete={handleSplashComplete}
      />
    );
  }

  // ── Loading fallback ──
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

  // ── Route rendering ──
  return (
    <div className="h-dvh w-full bg-[#090A0F] text-[#E0E0E6] flex flex-col justify-self-center overflow-hidden max-w-lg mx-auto shadow-[0_0_80px_rgba(9,10,15,0.95)] border-x border-white/5 relative safe-top">
      <AnimatePresence mode="wait">
        <Suspense fallback={<div className="h-full w-full bg-[#090A0F] text-[#E0E0E6] flex items-center justify-center"><div className="text-center space-y-4"><div className="text-4xl">🔄</div><p className="text-sm text-on-surface-variant">加载中...</p></div></div>}>
          <div key={location.pathname} className="flex-1 flex flex-col min-h-0">
            <AppRoutes
              handleLogin={handleLogin}
              handleRegister={handleRegister}
              handleGoogleLogin={handleGoogleLogin}
              handleLogout={handleLogout}
              handleNavigate={handleNavigate}
              handleGoBack={handleGoBack}
              characters={characters}
              publicCharacters={publicCharacters}
              userCharacters={userCharacters}
              user={user}
              currentUserHandle={currentUserHandle}
              currentCharacter={currentCharacter}
              editingCharacter={editingCharacter}
              setEditingCharacter={setEditingCharacter}
              favoriteIds={favoriteIds as string[]}
              handleToggleFavorite={handleToggleFavorite}
              handlePublishCharacter={handlePublishCharacter}
              handleAddReview={handleAddReview}
              handleUpdatePrivacy={handleUpdatePrivacy}
              handleCopyCharacter={handleCopyCharacter}
              handleDeleteCharacter={handleDeleteCharacter}
              chatThreads={chatThreads}
              sendingStates={sendingStates}
              activeCharacterId={activeCharacterId}
              setActiveCharacterId={setActiveCharacterId}
              handleSendMessage={handleSendMessage}
              handleDeleteMessage={handleDeleteMessage}
              handleStopGeneration={handleStopGeneration}
              handleEditMessage={handleEditMessage}
              deleteChatThreads={deleteChatThreads}
              updateChatThread={updateChatThread}
              clearUnreadCount={clearUnreadCount}
              locationPathname={location.pathname}
              myCharactersCount={myCharactersCount}
              characterApiRefresh={characterApiRefresh}
            />
          </div>
        </Suspense>
      </AnimatePresence>
    </div>
  );
}
