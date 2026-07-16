import type { AdminCharacterItem } from '../../types';

export function getFileName(c: AdminCharacterItem): string {
  const name = c._fileName || c.avatar || '';
  if (typeof name === 'string' && name.endsWith('.png')) return name;
  return '';
}

export function getCharKey(c: AdminCharacterItem): string {
  const fileName = getFileName(c);
  return `${c._owner}|${c._source}|${fileName || c.id || ''}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function sourceLabel(source: string): string {
  switch (source) {
    case 'seed':
      return '内置';
    case 'published':
      return '发布';
    case 'file':
      return '文件';
    default:
      return source || '-';
  }
}

export function avatarUrl(c: AdminCharacterItem): string | null {
  if (c._source === 'file') {
    const fn = getFileName(c);
    if (fn) return `/api/characters/avatar/${encodeURIComponent(fn)}`;
  }
  if (c.avatar && typeof c.avatar === 'string') {
    if (c.avatar.startsWith('http') || c.avatar.startsWith('/')) return c.avatar;
  }
  return null;
}
