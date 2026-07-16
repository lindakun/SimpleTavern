import { Search, User } from 'lucide-react';
import type {
  AdminCharacterPrivacyFilter,
  AdminCharacterSort,
  AdminCharacterSourceFilter,
} from '../../types';
import type { UserViewModel } from '../../types';

export interface CharacterFilterState {
  owner: string;
  source: AdminCharacterSourceFilter;
  privacy: AdminCharacterPrivacyFilter;
  tag: string;
  q: string;
  sort: AdminCharacterSort;
  order: 'asc' | 'desc';
}

interface Props {
  value: CharacterFilterState;
  onChange: (next: CharacterFilterState) => void;
  users: UserViewModel[];
  allTags: string[];
}

export default function CharacterFilters({ value, onChange, users, allTags }: Props) {
  const set = <K extends keyof CharacterFilterState>(key: K, v: CharacterFilterState[K]) => {
    onChange({ ...value, [key]: v });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
        <User className="w-3.5 h-3.5 text-on-surface-variant/60" />
        <select
          value={value.owner}
          onChange={(e) => set('owner', e.target.value)}
          className="bg-transparent text-xs text-white outline-none cursor-pointer"
        >
          <option value="ALL">全部拥有者</option>
          {users.map((u) => (
            <option key={u.handle} value={u.handle}>{u.handle}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
        <select
          value={value.source}
          onChange={(e) => set('source', e.target.value as AdminCharacterSourceFilter)}
          className="bg-transparent text-xs text-white outline-none cursor-pointer"
        >
          <option value="all">全部来源</option>
          <option value="seed">内置</option>
          <option value="published">发布</option>
          <option value="file">文件</option>
        </select>
      </div>

      <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
        <select
          value={value.privacy}
          onChange={(e) => set('privacy', e.target.value as AdminCharacterPrivacyFilter)}
          className="bg-transparent text-xs text-white outline-none cursor-pointer"
        >
          <option value="all">全部隐私</option>
          <option value="public">仅公开</option>
          <option value="private">仅私有</option>
        </select>
      </div>

      <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
        <select
          value={value.tag}
          onChange={(e) => set('tag', e.target.value)}
          className="bg-transparent text-xs text-white outline-none cursor-pointer"
        >
          <option value="ALL">全部标签</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
        <select
          value={value.sort}
          onChange={(e) => set('sort', e.target.value as AdminCharacterSort)}
          className="bg-transparent text-xs text-white outline-none cursor-pointer"
        >
          <option value="name">按名称</option>
          <option value="owner">按拥有者</option>
          <option value="date">按时间</option>
          <option value="size">按大小</option>
        </select>
        <select
          value={value.order}
          onChange={(e) => set('order', e.target.value as 'asc' | 'desc')}
          className="bg-transparent text-xs text-white outline-none cursor-pointer"
        >
          <option value="asc">升序</option>
          <option value="desc">降序</option>
        </select>
      </div>

      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
        <input
          type="text"
          value={value.q}
          onChange={(e) => set('q', e.target.value)}
          placeholder="按角色名称搜索..."
          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
        />
      </div>
    </div>
  );
}
