import type { ReactNode } from 'react';
import { ScreenId } from '../types';
import { Compass, MessageSquare, PlusCircle, UserCircle } from 'lucide-react';

interface TabConfig {
  screen: ScreenId;
  icon: ReactNode;
  label: string;
}

const TABS: TabConfig[] = [
  { screen: ScreenId.DISCOVER, icon: <Compass className="w-5 h-5" />, label: '角色' },
  { screen: ScreenId.MESSAGE_CENTER, icon: <MessageSquare className="w-5 h-5" />, label: '消息' },
  { screen: ScreenId.CREATE_CHOICE, icon: <PlusCircle className="w-5 h-5" />, label: '创建' },
  { screen: ScreenId.PROFILE, icon: <UserCircle className="w-5 h-5" />, label: '我的' },
];

/**
 * Find the nearest nav tab for a given screen.
 * CREATE_CHARACTER maps to PROFILE (user's content),
 * CHAT and CHARACTER_DETAIL map to DISCOVER (content browsing).
 */
function resolveActiveTab(currentScreen: ScreenId): ScreenId {
  if (currentScreen === ScreenId.CREATE_CHARACTER) return ScreenId.PROFILE;
  if (currentScreen === ScreenId.CHAT || currentScreen === ScreenId.CHARACTER_DETAIL) return ScreenId.DISCOVER;
  return currentScreen;
}

interface BottomNavProps {
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  unreadCount?: number;
  inline?: boolean;
}

export default function BottomNav({ currentScreen, onNavigate, unreadCount, inline }: BottomNavProps) {
  const activeTab = resolveActiveTab(currentScreen);

  const navClass = inline
    ? 'flex-shrink-0 w-full bg-surface-elevated/90 backdrop-blur-xl border-t border-outline-variant/40'
    : 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-surface-elevated/90 backdrop-blur-xl border-t border-outline-variant/40';

  return (
    <nav className={navClass}>
      <div className="flex h-16 items-center justify-around px-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.screen;
          return (
            <button
              key={tab.screen}
              onClick={() => onNavigate(tab.screen)}
              className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
                isActive ? 'text-accent-pink' : 'text-gray-400 hover:text-accent-pink'
              }`}
            >
              <span className="font-mono text-sm leading-none flex items-center justify-center relative">
                {tab.screen === ScreenId.MESSAGE_CENTER && unreadCount && unreadCount > 0 ? (
                  <>
                    {tab.icon}
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  </>
                ) : (
                  tab.icon
                )}
              </span>
              <span className="text-[10px] mt-1">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
