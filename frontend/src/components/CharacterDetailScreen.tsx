import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ScreenId, Character, Review } from '../types';
import { ChevronLeft, BookOpen, MessageSquare, ChevronDown, ChevronUp, Copy, Share2 } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { useWorldApi, WorldListItem } from '../api/worlds';
import { useToast } from './Toast';
import { track } from '../utils/analytics';

interface CharacterDetailScreenProps {
  character: Character;
  userHandle?: string;
  onNavigate: (screen: ScreenId) => void;
  onGoBack?: () => void;
  onAddReview: (characterId: string, review: Review) => void;
  onSelectCharacter: (id: string) => void;
  onCopyCharacter?: (character: Character) => void;
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
}

/** 快捷评价标签预设 */
const QUICK_TAGS = [
  '角色还原度高',
  '对话有趣',
  '设定详细',
  '性格鲜明',
  '世界观丰富',
  '建议优化回复',
];

/** 默认显示的评价数 */
const VISIBLE_REVIEWS = 4;

export default function CharacterDetailScreen({
  character,
  userHandle,
  onNavigate,
  onAddReview,
  onSelectCharacter,
  onCopyCharacter,
  favoriteIds,
  toggleFavorite,
  onGoBack,
}: CharacterDetailScreenProps) {
  const { showToast } = useToast();
  const [commentText, setCommentText] = useState('');
  const [userRating, setUserRating] = useState(5);
  const [newReviews, setNewReviews] = useState<Review[]>(character.reviews || []);
  const [worldList, setWorldList] = useState<WorldListItem[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const worldApi = useWorldApi();

  // 同步后端评论数据（角色切换或后端更新时同步）
  useEffect(() => {
    if (character.reviews) {
      setNewReviews(character.reviews);
    }
  }, [character.reviews]);

  // 加载世界书列表
  useEffect(() => {
    worldApi.listWorlds()
      .then((data) => setWorldList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const worldInfo = useMemo(() => {
    if (!character.worldBook) return null;
    const matched = worldList.find(w => w.file_id === character.worldBook);
    if (matched) {
      return { name: matched.name, isFileId: true as const };
    }
    return { name: character.worldBook, isFileId: false as const };
  }, [character.worldBook, worldList]);

  const isFavorite = favoriteIds.includes(character.id);

  // 双击收藏
  const lastTapRef = useRef(0);
  const DOUBLE_TAP_DELAY = 350;
  const [heartBurst, setHeartBurst] = useState(false);

  const handleAvatarDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      toggleFavorite(character.id);
      setHeartBurst(true);
      lastTapRef.current = 0;
      setTimeout(() => setHeartBurst(false), 600);
      track('toggle_favorite', { character_id: character.id, source: 'double_tap' });
    } else {
      lastTapRef.current = now;
    }
  }, [character.id, toggleFavorite]);

  // 计算平均评分
  const avgRating = useMemo(() => {
    if (newReviews.length === 0) return character.rating;
    const sum = newReviews.reduce((acc, r) => acc + r.rating, 0);
    return (sum / newReviews.length).toFixed(1);
  }, [newReviews, character.rating]);

  // 快捷标签点击
  const handleQuickTag = useCallback((tag: string) => {
    setCommentText(prev => prev ? `${prev}，「${tag}」` : tag);
  }, []);

  // 发表评价
  const handlePostReview = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newRev: Review = {
      id: 'rev_' + Date.now(),
      username: userHandle || '匿名特工',
      rating: userRating,
      comment: commentText,
      date: new Date().toISOString().split('T')[0] || '',
    };

    // 乐观更新
    setNewReviews([newRev, ...newReviews]);
    try {
      await onAddReview(character.id, newRev);
    } catch {
      // API 失败时回滚乐观更新
      setNewReviews(prev => prev.filter(r => r.id !== newRev.id));
      return;
    }

    track('submit_review', {
      character_id: character.id,
      rating: userRating,
      comment_length: commentText.length,
    });

    setCommentText('');
    setUserRating(5);
  }, [commentText, userRating, character.id, onAddReview, userHandle, newReviews]);

  // 可见的评价列表
  const displayedReviews = useMemo(() => {
    return showAllReviews ? newReviews : newReviews.slice(0, VISIBLE_REVIEWS);
  }, [newReviews, showAllReviews]);

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#0B0720] text-[#e3e1ee] safe-content-double">
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
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              const url = `${window.location.origin}/character/${character.id}`;
              try {
                await navigator.clipboard.writeText(url);
                showToast('链接已复制', 'success');
              } catch {
                showToast('复制失败', 'error');
              }
            }}
            className="p-2 text-on-surface-variant hover:text-accent-pink active:scale-95 transition-all cursor-pointer"
            title="分享角色"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => toggleFavorite(character.id)}
            className="p-2 text-accent-pink hover:scale-110 active:scale-95 transition-transform"
          >
            <span className="text-xl">{isFavorite ? '♥' : '♡'}</span>
          </button>
        </div>
      </header>

      {/* Hero Visual Area */}
      <div className="relative w-full min-h-[240px] max-h-[320px] h-[45vh] overflow-hidden border-b border-outline-variant/30">
        <LazyImage
          alt=""
          src={character.avatar}
          className="absolute inset-0 w-full h-full object-cover filter blur-xl scale-125 opacity-30 select-none"
        />
        <div className="relative z-10 w-full h-full flex flex-col justify-center items-center py-6 text-center bg-gradient-to-t from-background-deep to-transparent">
          <div
            className="relative w-28 h-28 rounded-2xl overflow-hidden border-2 border-accent-pink shadow-[0_0_25px_rgba(232,121,199,0.3)] cursor-pointer"
            onClick={handleAvatarDoubleTap}
          >
            <LazyImage
              alt={character.name}
              referrerPolicy="no-referrer"
              src={character.avatar}
              className="w-full h-full object-cover"
            />
          </div>
          {heartBurst && (
            <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
              <span className="text-5xl text-accent-pink animate-[heart-burst_0.6s_ease-out_forwards]">♥</span>
            </div>
          )}
          <h2 className="text-xl font-bold mt-4 tracking-wide text-white">{character.name}</h2>
          <span className="text-xs text-on-surface-variant font-mono mt-1">创建者: {character.creator}</span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8 relative z-10">
        {/* Overview cards */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-surface-container/40 border border-outline-variant/20 p-3 rounded-xl backdrop-blur-md">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block mb-1">综合评分</span>
            <span className="text-sm font-bold text-accent-pink font-mono">★ {avgRating}</span>
            {newReviews.length > 0 && (
              <span className="block text-[9px] text-on-surface-variant/60 mt-0.5">{newReviews.length}条评价</span>
            )}
          </div>
          <div className="bg-surface-container/40 border border-outline-variant/20 p-3 rounded-xl backdrop-blur-md">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block mb-1">配音方案</span>
            <span className="text-sm font-bold text-[#ffade2]">
              {character.voiceType === 'sweet' ? '甜美少女' : character.voiceType === 'mature' ? '成熟御姐' : '未设置'}
            </span>
          </div>
          <div className="bg-surface-container/40 border border-outline-variant/20 p-3 rounded-xl backdrop-blur-md">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider font-mono block mb-1">世界树条目</span>
            <span className="text-sm font-bold text-accent-purple font-mono">
              {worldInfo ? (worldInfo.isFileId ? worldInfo.name : '已注入') : '缺省'}
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

        {/* World Book */}
        {worldInfo && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent-pink" />
              <h3 className="text-sm font-bold text-[#ffd8ee] uppercase tracking-wider font-mono">世界书 (Worldbook)</h3>
            </div>
            {worldInfo.isFileId ? (
              <div className="bg-surface-container/50 border border-accent-purple/30 p-4 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-accent-purple" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{worldInfo.name}</p>
                  <p className="text-[10px] text-on-surface-variant">绑定世界书 · 聊天时自动注入</p>
                </div>
              </div>
            ) : (
              <div className="bg-surface-container/50 border border-outline-variant/30 p-4 rounded-xl space-y-2 text-xs leading-relaxed text-on-surface-variant whitespace-pre-wrap">
                {character.worldBook}
              </div>
            )}
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

        {/* ─── 评价系统（优化后）─── */}
        <div className="space-y-6 pt-4 border-t border-outline-variant/20">
          {/* 评价头部：评分概览 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-accent-pink" />
              <h3 className="text-sm font-bold text-[#ffade2]">特工反馈与会话评价</h3>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-pink/10 border border-accent-pink/20">
              <span className="text-[#ffade2] text-sm font-bold">★ {avgRating}</span>
              <span className="text-[10px] text-on-surface-variant/60">({newReviews.length})</span>
            </div>
          </div>

          {/* 快捷评价标签 */}
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQuickTag(tag)}
                className="px-2.5 py-1 rounded-full text-[10px] border border-accent-pink/20 text-accent-pink/80 hover:bg-accent-pink/10 hover:border-accent-pink/40 transition-all cursor-pointer tap-dim"
              >
                + {tag}
              </button>
            ))}
          </div>

          {/* New Review Submission form */}
          <form onSubmit={handlePostReview} className="space-y-4 bg-surface-container/30 p-4 rounded-xl border border-outline-variant/20">
            <h4 className="text-xs font-semibold text-on-surface-variant">在此输入您的互动评价：</h4>

            {/* Rating Stars selector — 优化：更紧凑的交互 */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-on-surface-variant/60 font-mono">评分:</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUserRating(star)}
                    className="text-lg focus:outline-none border-0 bg-transparent cursor-pointer hover:scale-110 active:scale-90 transition-transform touch-target"
                    aria-label={`${star} 星`}
                  >
                    <span className={star <= userRating ? 'text-[#ffade2] drop-shadow-[0_0_6px_rgba(255,173,226,0.5)]' : 'text-gray-600'}>
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-on-surface-variant/40 ml-1">{userRating}/5</span>
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
                className="px-4 py-2 bg-accent-pink/10 hover:bg-accent-pink border border-accent-pink/40 text-xs text-accent-pink hover:text-white rounded-xl font-bold transition-all cursor-pointer tap-dim"
              >
                发表
              </button>
            </div>
          </form>

          {/* 评价列表 — 分页折叠 */}
          <div className="space-y-3">
            {newReviews.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
                <p className="text-xs text-on-surface-variant">暂无特工会话评价，成为第一个评价者吧</p>
              </div>
            ) : (
              <>
                {displayedReviews.map((rev, index) => (
                  <div
                    key={rev.id}
                    className="bg-surface-elevated/40 border border-outline-variant/10 p-4 rounded-xl space-y-2 animate-subtle-fadeIn"
                    style={{ animationDelay: `${Math.min(index, VISIBLE_REVIEWS) * 50}ms` }}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-mono text-accent-pink">@{rev.username}</span>
                      <div className="flex items-center gap-2">
                        {/* 星级显示 */}
                        <span className="text-[#ffd8ee] font-bold">
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </span>
                        <span className="text-on-surface-variant/40 font-mono">{rev.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{rev.comment}</p>
                  </div>
                ))}

                {/* 查看更多 / 收起 */}
                {newReviews.length > VISIBLE_REVIEWS && (
                  <button
                    onClick={() => setShowAllReviews(!showAllReviews)}
                    className="w-full py-2.5 rounded-xl bg-surface-container/30 border border-outline-variant/20 hover:border-accent-pink/30 text-xs text-on-surface-variant hover:text-accent-pink transition-all cursor-pointer flex items-center justify-center gap-1 tap-dim"
                  >
                    {showAllReviews ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        收起评价
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        查看全部 {newReviews.length} 条评价
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Actions Strip */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-lg z-30 px-6 py-4 bg-background-deep/90 border-t border-outline-variant/30 flex items-center justify-center gap-4 shadow-[0_-5px_25px_rgba(11,7,32,0.8)] safe-bottom">
        <button
          onClick={() => onNavigate(ScreenId.DISCOVER)}
          className="flex-1 h-12 bg-surface-elevated/80 hover:bg-surface-elevated border border-outline-variant/40 text-[#ffd8ee] rounded-xl font-bold text-xs shadow-md active:scale-95 transition-transform cursor-pointer"
        >
          探索其它角色列表
        </button>

        {/* 复制公共角色 */}
        {character.privacyType === 'public' && onCopyCharacter && (
          <button
            onClick={() => {
              onCopyCharacter(character);
              track('copy_character', { character_id: character.id, source: 'detail_page' });
            }}
            className="h-12 px-4 bg-accent-green/10 hover:bg-accent-green/20 border border-accent-green/30 text-accent-green rounded-xl font-bold text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-2"
            title="复制到我的角色"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>复制</span>
          </button>
        )}

        <button
          onClick={() => {
            onSelectCharacter(character.id);
            onNavigate(ScreenId.CHAT);
            track('start_chat', { character_id: character.id, source: 'detail_page' });
          }}
          className="flex-1 h-12 bg-gradient-to-r from-accent-pink to-accent-purple text-white rounded-xl font-bold text-xs shadow-[0_4px_15px_rgba(232,121,199,0.3)] active:scale-95 transition-transform flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>开始聊天</span>
        </button>
      </div>

      <BottomNav currentScreen={ScreenId.CHARACTER_DETAIL} onNavigate={onNavigate} />
    </div>
  );
}
