import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ScreenId, Character } from '../types';
import { Search, X, RefreshCw } from 'lucide-react';
import BottomNav from './BottomNav';
import LazyImage from './LazyImage';
import { CharacterCardSkeleton } from './Skeleton';
import { track } from '../utils/analytics';

interface DiscoverScreenProps {
  characters: Character[];
  onNavigate: (screen: ScreenId) => void;
  onSelectCharacter: (id: string) => void;
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
  onRefresh?: () => Promise<void>;
}

/** 估算每张角色卡片高度（含 gap） */
const ESTIMATED_CARD_HEIGHT = 400;
const DOUBLE_TAP_DELAY = 350;

export default function DiscoverScreen({
  characters,
  onNavigate,
  onSelectCharacter,
  favoriteIds,
  toggleFavorite,
  onRefresh,
}: DiscoverScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 下拉刷新状态
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);
  const PULL_THRESHOLD = 80;
  const MAX_PULL = 150;

  // 双击检测：存储待处理的单击定时器
  const doubleTapTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Unique tags across characters (plus ALL)
  const allTags = useMemo(() => ['ALL', ...Array.from(new Set(characters.flatMap((c) => c.tags)))], [characters]);

  const filteredCharacters = useMemo(() => characters.filter((c) => {
    // Exclude draft characters from discover feed
    if (c.status === 'draft') return false;

    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (c.tagline || c.description).toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'ALL' || c.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  }), [characters, searchQuery, selectedTag]);

  // ─── 虚拟滚动（必须在 pull 手势处理器之前声明）───
  const rowVirtualizer = useVirtualizer({
    count: filteredCharacters.length || 6, // 无数据时显示6个骨架
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_CARD_HEIGHT,
    overscan: 3,
  });

  // ─── 下拉刷新 ───
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const el = scrollContainerRef.current;
    if (!el || el.scrollTop > 5) return;
    touchStartY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || refreshing) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta <= 0) { setPullDistance(0); return; }
    setPullDistance(Math.min(delta * 0.4, MAX_PULL));
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    isPulling.current = false;
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      setRefreshing(true);
      try {
        if (onRefresh) {
          await onRefresh();
          setLoadError(false);
        }
        rowVirtualizer.measure();
      } catch {
        setLoadError(true);
      }
      setRefreshing(false);
    }
    setPullDistance(0);
  }, [pullDistance, refreshing, rowVirtualizer, onRefresh]);

  const pullProgress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  // ─── 双击收藏（延时单击模式：单击立即导航，双击取消导航 + 收藏）───
  const handleCardClick = useCallback((characterId: string) => {
    // 如果存在待处理的单击定时器 → 这是双击
    if (doubleTapTimers.current[characterId]) {
      clearTimeout(doubleTapTimers.current[characterId]);
      delete doubleTapTimers.current[characterId];
      toggleFavorite(characterId);
      return;
    }

    // 首次点击 → 等待 DOUBLE_TAP_DELAY 后再导航
    doubleTapTimers.current[characterId] = setTimeout(() => {
      delete doubleTapTimers.current[characterId];
      onSelectCharacter(characterId);
      onNavigate(ScreenId.CHARACTER_DETAIL);
    }, DOUBLE_TAP_DELAY);
  }, [onSelectCharacter, onNavigate, toggleFavorite]);

  // 清理定时器
  const cleanupDoubleTapTimer = useCallback((characterId: string) => {
    if (doubleTapTimers.current[characterId]) {
      clearTimeout(doubleTapTimers.current[characterId]);
      delete doubleTapTimers.current[characterId];
    }
  }, []);

  // 当筛选结果变化时，清理不在当前列表中的 stale 定时器
  const currentIds = useMemo(() => new Set(filteredCharacters.map(c => c.id)), [filteredCharacters]);
  useEffect(() => {
    Object.keys(doubleTapTimers.current).forEach((id) => {
      if (!currentIds.has(id)) {
        clearTimeout(doubleTapTimers.current[id]);
        delete doubleTapTimers.current[id];
      }
    });
  }, [currentIds]);

  // 搜索埋点（防抖 800ms）
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const timer = setTimeout(() => {
      track('search', { query: searchQuery, result_count: filteredCharacters.length });
    }, 800);
    return () => clearTimeout(timer);
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-background-deep text-white">
      {/* Light glow effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-accent-pink opacity-10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Top Search bar Header */}
      <header className="flex-shrink-0 z-40 bg-background-deep/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-full border border-accent-pink/40 object-cover shadow-[0_0_10px_rgba(232,121,199,0.3)]"
          />
          <span className="font-headline-lg font-extrabold text-[#ffade2] tracking-wider text-xl">Yuzu AI</span>
        </div>

        {/* Search Input Container */}
        <div className="flex-1 max-w-sm mx-4 relative">
          <input
            type="text"
            placeholder="搜索AI角色或特征..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-container/80 border border-outline-variant/40 rounded-full py-1.5 px-4 pl-10 text-xs text-white focus:outline-none focus:border-accent-pink transition-all"
          />
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white flex items-center justify-center border-0 bg-transparent cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* Horizontal tag filter strip */}
      <div className="flex-shrink-0 px-[18px] pt-2 pb-1">
        <div className="flex gap-2.5 overflow-x-auto pb-2 w-[319px] max-w-full mx-auto scrollable-touch scrollbar-none">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 border whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-accent-pink border-accent-pink text-white shadow-[0_0_15px_rgba(232,121,199,0.3)]'
                  : 'bg-surface-elevated/40 border-outline-variant/30 text-on-surface hover:border-accent-pink/50'
              }`}
            >
              {tag === 'ALL' ? '全部' : tag}
            </button>
          ))}
        </div>
      </div>

      {/* Virtual scroll list — 集成下拉刷新 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto scrollable-touch safe-content-bottom"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 下拉刷新指示器 */}
        <div
          className="flex items-center justify-center transition-all duration-200 overflow-hidden"
          style={{ height: `${pullDistance}px`, opacity: pullDistance > 10 ? pullProgress : 0 }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw
              className={`w-4 h-4 text-accent-pink ${refreshing ? 'animate-spin' : ''}`}
              style={{ transform: refreshing ? undefined : `rotate(${pullProgress * 360}deg)` }}
            />
            <span className="text-[10px] text-accent-pink/60 font-mono">
              {refreshing ? '同步中...' : pullProgress >= 1 ? '释放刷新' : '下拉刷新'}
            </span>
          </div>
        </div>
        {/* 空搜索结果 */}
        {filteredCharacters.length === 0 && searchQuery && (
          <div className="py-12 mx-[18px] bg-surface-container/30 border border-outline-variant/20 rounded-2xl text-center text-on-surface-variant">
            没有找到匹配的AI角色
          </div>
        )}

        {/* 加载失败 */}
        {loadError && filteredCharacters.length === 0 && (
          <div className="py-16 mx-[18px] bg-surface-container/30 border border-red-500/20 rounded-2xl text-center">
            <p className="text-sm text-red-400 mb-3">加载失败</p>
            <button
              onClick={async () => {
                setLoadError(false);
                if (onRefresh) {
                  try { await onRefresh(); } catch { setLoadError(true); }
                }
              }}
              className="px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 hover:bg-red-500/20 cursor-pointer transition-colors"
            >
              点击重试
            </button>
          </div>
        )}

        {/* 骨架屏（数据未加载时） */}
        {!loadError && filteredCharacters.length === 0 && !searchQuery && (
          <div className="px-[18px] max-w-7xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <CharacterCardSkeleton key={i} />
              ))}
            </div>
          </div>
        )}

        {/* 虚拟滚动列表 */}
        {filteredCharacters.length > 0 && (
          <div
            className="px-[18px] max-w-7xl mx-auto"
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const c = filteredCharacters[virtualItem.index];
              if (!c) return null;
              const isFavorite = favoriteIds.includes(c.id);

              return (
                <div
                  key={c.id}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  className="absolute top-0 left-0 right-0 px-0 pb-4"
                  style={{
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <div className="group relative rounded-2xl overflow-hidden bg-surface-container/50 border border-outline-variant/30 hover:border-accent-pink/40 hover:shadow-[0_0_25px_rgba(232,121,199,0.15)] transition-all duration-300 flex flex-col justify-between">
                    {/* Top image panel — 支持双击收藏 */}
                    <div
                      className="aspect-[4/3] relative overflow-hidden bg-zinc-900 cursor-pointer"
                      onClick={() => handleCardClick(c.id)}
                    >
                      <LazyImage
                        src={c.avatar}
                        alt={c.name}
                        referrerPolicy="no-referrer"
                        aspectRatio="4/3"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background-deep/90 via-transparent to-transparent opacity-80" />

                      {/* Favorites switch */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // 点击收藏按钮前清理可能的双击定时器
                          cleanupDoubleTapTimer(c.id);
                          toggleFavorite(c.id);
                        }}
                        className="absolute top-3 right-3 p-2 rounded-full backdrop-blur-md bg-background-deep/60 border border-white/10 hover:border-accent-pink focus:outline-none transition-all cursor-pointer"
                      >
                        <span className={`text-sm ${isFavorite ? 'text-accent-pink animate-pulse' : 'text-gray-400'}`}>
                          {isFavorite ? '♥' : '♡'}
                        </span>
                      </button>

                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                        <span className="text-xs bg-[#0F111A]/90 border border-accent-pink/40 px-2 py-0.5 rounded-full font-mono text-accent-pink">
                          {c.voiceType === 'sweet' ? '🔊 甜美少女' : '🔊 成熟御姐'}
                        </span>
                        <div className="flex items-center gap-1.5 bg-black/60 px-2 py-0.5 rounded-full backdrop-blur-md">
                          <span className="text-[#ffade2] text-[10px] font-bold">★ {c.rating}</span>
                        </div>
                      </div>
                    </div>

                    {/* Meta info bottom */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3 bg-surface-container">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-white tracking-wide group-hover:text-accent-pink duration-200">
                            {c.id === 'yuki' ? 'Yuki Murasaki' : c.name}
                          </h4>
                          <span className="text-[10px] text-on-surface-variant font-mono">@{c.creator}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                          {c.tagline || c.description?.slice(0, 60)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {c.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-0.2 bg-surface-elevated text-on-surface-variant rounded text-[10px] border border-outline-variant/30">
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cleanupDoubleTapTimer(c.id);
                            onSelectCharacter(c.id);
                            onNavigate(ScreenId.CHARACTER_DETAIL);
                          }}
                          className="text-xs text-accent-pink hover:text-white transition-colors cursor-pointer"
                        >
                          查看详情 →
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            cleanupDoubleTapTimer(c.id);
                            onSelectCharacter(c.id);
                            onNavigate(ScreenId.CHAT);
                          }}
                          className="px-3.5 py-1 bg-surface-elevated/80 hover:bg-gradient-to-r hover:from-accent-pink hover:to-accent-purple hover:text-white text-xs border border-accent-pink/30 hover:border-transparent rounded-lg transition-all cursor-pointer"
                        >
                          开始聊天
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav currentScreen={ScreenId.DISCOVER} onNavigate={onNavigate} />
    </div>
  );
}
