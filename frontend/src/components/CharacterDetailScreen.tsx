import React, { useState } from 'react';
import { ScreenId, Character, Review } from '../types';
import { ChevronLeft } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';

interface CharacterDetailScreenProps {
  character: Character;
  onNavigate: (screen: ScreenId) => void;
  onGoBack?: () => void;
  onAddReview: (characterId: string, review: Review) => void;
  onSelectCharacter: (id: string) => void;
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
}

export default function CharacterDetailScreen({
  character,
  onNavigate,
  onAddReview,
  onSelectCharacter,
  favoriteIds,
  toggleFavorite,
  onGoBack,
}: CharacterDetailScreenProps) {
  const [commentText, setCommentText] = useState('');
  const [userRating, setUserRating] = useState(5);
  const [newReviews, setNewReviews] = useState<Review[]>(character.reviews || []);

  const isFavorite = favoriteIds.includes(character.id);

  const handlePostReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newRev: Review = {
      id: 'rev_' + Date.now(),
      username: '霓虹特工_Pilot',
      rating: userRating,
      comment: commentText,
      date: new Date().toISOString().split('T')[0] || '',
    };

    onAddReview(character.id, newRev);
    setNewReviews([newRev, ...newReviews]);
    setCommentText('');
    setUserRating(5);
  };

  return (
    <div className="relative min-h-screen bg-[#0B0720] text-[#e3e1ee] pb-28">
      {/* Glow Effects */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-accent-pink opacity-10 blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Floating Top Nav Bar */}
      <header className="sticky top-0 z-40 bg-background-deep/80 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-outline-variant/20">
        <button
          onClick={() => onGoBack ? onGoBack() : onNavigate(ScreenId.DISCOVER)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">返回</span>
        </button>
        <span className="font-bold text-sm tracking-widest text-[#ffd8ee] font-headline-lg-mobile">
          角色档案 • {character.name}
        </span>
        <button
          onClick={() => toggleFavorite(character.id)}
          className="p-2 text-accent-pink hover:scale-110 active:scale-95 transition-transform"
        >
          <span className="text-xl">{isFavorite ? '♥' : '♡'}</span>
        </button>
      </header>

      {/* Hero Visual Area with Blurred Backing */}
      <div className="relative w-full h-[320px] overflow-hidden border-b border-outline-variant/30">
        {/* Full-screen blur backdrop */}
        <LazyImage
          alt=""
          src={character.avatar}
          className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-125 opacity-30 select-none"
        />
        {/* Centered avatar container card */}
        <div className="relative z-10 w-full h-full flex flex-col justify-center items-center py-6 text-center bg-gradient-to-t from-background-deep to-transparent">
          <div className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-accent-pink shadow-[0_0_25px_rgba(232,121,199,0.3)]">
            <LazyImage
              alt={character.name}
              referrerPolicy="no-referrer"
              src={character.avatar}
              className="w-full h-full object-cover"
            />
          </div>
          <h2 className="text-xl font-bold mt-4 tracking-wide text-white">{character.name}</h2>
          <span className="text-xs text-on-surface-variant font-mono mt-1">创建者: {character.creator}</span>
        </div>
      </div>

      {/* Main specification lists */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8 relative z-10">
        {/* Overview cards */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-surface-container/40 border border-outline-variant/20 p-3 rounded-xl backdrop-blur-md">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block mb-1">会话评分</span>
            <span className="text-sm font-bold text-accent-pink font-mono">★ {character.rating}</span>
          </div>
          <div className="bg-surface-container/40 border border-outline-variant/20 p-3 rounded-xl backdrop-blur-md">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block mb-1">配音方案</span>
            <span className="text-sm font-bold text-[#ffade2]">
              {character.voiceType === 'sweet' ? '甜美少女' : '成熟御姐'}
            </span>
          </div>
          <div className="bg-surface-container/40 border border-outline-variant/20 p-3 rounded-xl backdrop-blur-md">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block mb-1">世界树条目</span>
            <span className="text-sm font-bold text-accent-purple font-mono">
              {character.worldBook ? '已注入' : '缺省'}
            </span>
          </div>
        </div>

        {/* Character Backstory */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-[#ffade2] uppercase tracking-wider font-mono">角色微设定 (Tagline)</h3>
          <p className="text-sm bg-surface-container/30 border border-outline-variant/20 p-4 rounded-xl leading-relaxed text-on-surface-variant">
            {character.description}
          </p>
        </div>

        {/* World Book Detailed Panel */}
        {character.worldBook && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-accent-pink">book</span>
              <h3 className="text-sm font-bold text-[#ffd8ee] uppercase tracking-wider font-mono">世界书 (Worldbook) 配置</h3>
            </div>
            <div className="bg-surface-container/50 border border-outline-variant/30 p-4 rounded-xl space-y-2 text-xs leading-relaxed text-on-surface-variant whitespace-pre-wrap">
              {character.worldBook}
            </div>
          </div>
        )}

        {/* Tags section */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider font-mono">性格标签 (Traits)</h3>
          <div className="flex flex-wrap gap-2">
            {character.tags.map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 bg-surface-elevated/40 border border-accent-pink/20 rounded-full text-xs text-[#ffade2]"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* User Reviews Panel */}
        <div className="space-y-6 pt-4 border-t border-outline-variant/20">
          <h3 className="text-sm font-bold text-[#ffade2]">特工反馈与会话评价 ({newReviews.length})</h3>

          {/* New Review Submission form */}
          <form onSubmit={handlePostReview} className="space-y-4 bg-surface-container/30 p-4 rounded-xl border border-outline-variant/20">
            <h4 className="text-xs font-semibold text-on-surface-variant">在此输入您的互动评价：</h4>
            
            {/* Rating Stars selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-on-surface-variant">评分评分：</span>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUserRating(star)}
                    className="text-lg focus:outline-none border-0 bg-transparent cursor-pointer"
                  >
                    <span className={star <= userRating ? 'text-[#ffade2]' : 'text-gray-600'}>★</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="柚姬酱的反馈符合世界设定吗？在此处写出评价..."
                className="flex-1 bg-surface-elevated border border-outline-variant/40 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-accent-pink"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-accent-pink/10 hover:bg-accent-pink border border-accent-pink/40 text-xs text-accent-pink hover:text-white rounded-xl font-bold transition-all cursor-pointer"
              >
                发表
              </button>
            </div>
          </form>

          {/* List existing reviews */}
          <div className="space-y-4">
            {newReviews.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center pb-4">暂无特工会话评价</p>
            ) : (
              newReviews.map((rev) => (
                <div key={rev.id} className="bg-surface-elevated/40 border border-outline-variant/10 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-mono text-accent-pink">@{rev.username}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[#ffd8ee] font-bold">★ {rev.rating}</span>
                      <span className="text-on-surface-variant/40 font-mono">{rev.date}</span>
                    </div>
                  </div>
                  <p className="text-xs text-on-surface-variant leading-relaxed font-body-sm">{rev.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Actions Strip */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 px-6 py-4 bg-background-deep/90 border-t border-outline-variant/30 flex items-center justify-center gap-4 shadow-[0_-5px_25px_rgba(11,7,32,0.8)]">
        <button
          onClick={() => onNavigate(ScreenId.DISCOVER)}
          className="flex-1 h-12 bg-surface-elevated/80 hover:bg-surface-elevated border border-outline-variant/40 text-[#ffd8ee] rounded-xl font-bold text-xs shadow-md active:scale-95 transition-transform cursor-pointer"
        >
          探索其它角色列表
        </button>

        {/* Start Chat Button - Triggers CHAT screen (push transition) */}
        <button
          onClick={() => { onSelectCharacter(character.id); onNavigate(ScreenId.CHAT); }}
          className="flex-1 h-12 bg-gradient-to-r from-accent-pink to-accent-purple text-white rounded-xl font-bold text-xs shadow-[0_4px_15px_rgba(232,121,199,0.3)] active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>开始聊天</span>
        </button>
      </div>

      <BottomNav currentScreen={ScreenId.CHARACTER_DETAIL} onNavigate={onNavigate} />
    </div>
  );
}
