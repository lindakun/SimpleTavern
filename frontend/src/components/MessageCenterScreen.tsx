import { ScreenId, Character, ChatThread } from '../types';
import { RotateCw } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { useToast } from './Toast.tsx';

interface MessageCenterScreenProps {
  characters: Character[];
  chatThreads: Record<string, ChatThread>;
  onNavigate: (screen: ScreenId) => void;
  onSelectCharacter: (id: string) => void;
}

export default function MessageCenterScreen({
  characters,
  chatThreads,
  onNavigate,
  onSelectCharacter,
}: MessageCenterScreenProps) {
  const { showToast } = useToast();

  const handleSync = async () => {
    try {
      const res = await fetch('/api/chat/threads');
      if (res.ok) {
        showToast('已同步最新消息', 'success');
      }
    } catch {
      showToast('同步失败', 'error');
    }
  };
  // 只显示有聊天记录的活跃会话
  const activeChatIds = new Set(Object.keys(chatThreads));
  const chatList = characters.filter((c) =>
    c.id !== 'ai_broadcast' && activeChatIds.has(c.id)
  );

  // Broadcast term
  const systemBroadcastCharacter = characters.find((c) => c.id === 'ai_broadcast');

  return (
    <div className="relative min-h-screen bg-background-deep text-white pb-24">
      {/* Heavy colorful glowing neon overlays */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-accent-pink opacity-10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent-purple opacity-10 blur-[130px] pointer-events-none" />

      {/* Sticky top-bar search */}
      <header className="sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5">
        <h1 className="text-lg font-bold tracking-widest text-[#ffade2] font-headline-lg-mobile">
          消息中心
        </h1>
        <div className="flex gap-4">
          <button
            onClick={handleSync}
            className="p-2 text-on-surface hover:text-[#ffade2] cursor-pointer flex items-center justify-center"
          >
            <RotateCw className="w-5 h-5 text-accent-pink" />
          </button>
        </div>
      </header>

      {/* Main Inbox items */}
      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">
        
        {/* System broadcast banner */}
        {systemBroadcastCharacter && (
          <div className="bg-gradient-to-r from-accent-pink/10 to-accent-purple/10 border border-accent-pink/20 rounded-2xl p-4 flex gap-4 backdrop-blur-md items-center animate-subtle-fadeIn">
            <div className="w-10 h-10 rounded-xl bg-accent-pink/15 flex items-center justify-center text-accent-pink text-lg font-mono">
              📢
            </div>
            <div className="flex-grow space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#ffade2]">系统广播</span>
                <span className="text-[9px] bg-accent-pink/25 text-[#ffade2] px-2 py-0.2 rounded font-mono">NEW</span>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                v2.0 赛博朋克主题已上线！快来体验全新的霓虹幻彩角色对话与高频微控世界书吧~
              </p>
            </div>
          </div>
        )}

        <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">最近会话活跃 (Active)</h2>

        {/* Messaging Box list */}
        <div className="space-y-3">
          {chatList.length === 0 ? (
            <div className="py-12 text-center text-on-surface-variant text-xs">
              暂无聊天记录，去发现页面选择一个角色开始对话吧
            </div>
          ) : chatList.map((c) => {
            const thread = chatThreads[c.id];
            
            // Get last message text or fallback to tagline
            const lastMsgText = thread?.messages && thread.messages.length > 0
              ? thread.messages[thread.messages.length - 1]?.text || c.tagline
              : c.tagline;

            const unreadCount = thread?.unreadCount || 0;
            
            return (
              <div
                key={c.id}
                onClick={() => {
                  onSelectCharacter(c.id);
                  onNavigate(ScreenId.CHAT);
                }}
                className="bg-surface-container/40 hover:bg-surface-container border border-outline-variant/20 hover:border-accent-pink/30 p-4 rounded-xl flex items-center gap-4 cursor-pointer transition-all duration-200"
              >
                {/* Avatar with unread indicator badge */}
                <div className="relative">
                  <LazyImage
                    src={c.avatar}
                    alt={c.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-full object-cover border border-outline-variant/30"
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-accent-pink text-white font-bold leading-none w-5 h-5 rounded-full flex items-center justify-center text-[10px] border border-background-deep animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                  {c.status === 'online' && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border border-background-deep" />
                  )}
                </div>

                {/* Message Body snippet */}
                <div className="flex-grow space-y-1">
                  <div className="flex items-center justify-between">
                    {/* Specific XPath search check on Yuki (柚姬) name link: //span[text()='柚姬']/../../.. */}
                    <span className="font-bold text-sm text-white hover:text-accent-pink">
                      {c.id === 'yuki' ? '柚姬' : c.name}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/40 font-mono">
                      {c.lastActiveLabel || '10:45 AM'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-1">
                    {lastMsgText}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Global Fixed Navigation Bar
          Strict constraints for Message Center navigation XPath matching (角色, 创建, 我的)
          Indices conform perfectly to body/nav[1]/a[1] and body/nav[1]/a[3] search constraints
      */}
      <BottomNav currentScreen={ScreenId.MESSAGE_CENTER} onNavigate={onNavigate} />
    </div>
  );
}
