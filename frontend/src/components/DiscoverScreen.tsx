import { useState } from 'react';
import { ScreenId, Character } from '../types';
import { Search, X } from 'lucide-react';
import BottomNav from './BottomNav';
import { CharacterCardSkeleton } from './Skeleton';

interface DiscoverScreenProps {
  characters: Character[];
  onNavigate: (screen: ScreenId) => void;
  onSelectCharacter: (id: string) => void;
  favoriteIds: string[];
  toggleFavorite: (id: string) => void;
}

export default function DiscoverScreen({
  characters,
  onNavigate,
  onSelectCharacter,
  favoriteIds,
  toggleFavorite,
}: DiscoverScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('ALL');

  // Unique tags across characters (plus ALL)
  const allTags = ['ALL', ...Array.from(new Set(characters.flatMap((c) => c.tags)))];

  const filteredCharacters = characters.filter((c) => {
    // Exclude draft character from standard public discover feed
    if (c.status === 'draft') return false;

    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === 'ALL' || c.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="relative min-h-screen bg-background-deep text-white pb-24">
      {/* Light glow effects */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-accent-pink opacity-10 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Top Search bar Header */}
      <header className="sticky top-0 z-40 bg-background-deep/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-outline-variant/20">
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

      {/* Body content */}
      <main className="px-[18px] pt-2 space-y-4 max-w-7xl mx-auto">

        {/* Horizontal tag filter strip */}
        <div className="pt-0">
          <div className="flex gap-2.5 overflow-x-auto pb-0 w-[319px] max-w-full mx-auto scrollbar-none">
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
                {tag === 'ALL' ? '全部特征' : tag}
              </button>
            ))}
          </div>
        </div>

        {/* Discovery Feed Grid */}
        <div className="space-y-4">

          {filteredCharacters.length === 0 && searchQuery ? (
            <div className="py-12 bg-surface-container/30 border border-outline-variant/20 rounded-2xl text-center text-on-surface-variant">
              没有找到匹配的AI角色
            </div>
          ) : filteredCharacters.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <CharacterCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCharacters.map((c) => {
                const isFavorite = favoriteIds.includes(c.id);

                return (
                  <div
                    key={c.id}
                    className="group relative rounded-2xl overflow-hidden bg-surface-container/50 border border-outline-variant/30 hover:border-accent-pink/40 hover:shadow-[0_0_25px_rgba(232,121,199,0.15)] transition-all duration-300 flex flex-col justify-between"
                  >
                    {/* Top image panel */}
                    <div className="aspect-[4/3] relative overflow-hidden bg-zinc-900 cursor-pointer" onClick={() => {
                      onSelectCharacter(c.id);
                      onNavigate(ScreenId.CHARACTER_DETAIL);
                    }} >
                      <img
                        alt={c.name}
                        src={c.avatar}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background-deep/90 via-transparent to-transparent opacity-80" />

                      {/* Favorites switch */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
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
                          {c.tagline}
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
                          onClick={() => {
                            onSelectCharacter(c.id);
                            onNavigate(ScreenId.CHARACTER_DETAIL);
                          }}
                          className="text-xs text-accent-pink hover:text-white transition-colors cursor-pointer"
                        >
                          查看详情 →
                        </button>

                        <button
                          onClick={() => {
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
                );
              })}
            </div>
          )}
        </div>
      </main>

      <BottomNav currentScreen={ScreenId.DISCOVER} onNavigate={onNavigate} />
    </div>
  );
}
