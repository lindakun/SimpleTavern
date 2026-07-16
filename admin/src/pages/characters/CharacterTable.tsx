import {
  CheckSquare, Square, Eye, Pencil, Trash2, Check, X, Lock, Unlock,
} from 'lucide-react';
import type { AdminCharacterItem } from '../../types';
import { avatarUrl, formatSize, getCharKey, getFileName, sourceLabel } from './utils';

interface Props {
  characters: AdminCharacterItem[];
  selectedKeys: Set<string>;
  confirmDelete: { owner: string; avatar: string; source: string } | null;
  onToggleSelect: (key: string) => void;
  onToggleSelectAll: () => void;
  onOpenDetail: (c: AdminCharacterItem) => void;
  onEdit: (c: AdminCharacterItem) => void;
  onTogglePrivacy: (c: AdminCharacterItem) => void;
  onRequestDelete: (c: AdminCharacterItem) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deletePending: boolean;
  privacyPending: boolean;
}

export default function CharacterTable({
  characters,
  selectedKeys,
  confirmDelete,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  onEdit,
  onTogglePrivacy,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  deletePending,
  privacyPending,
}: Props) {
  const allSelected = characters.length > 0 && selectedKeys.size === characters.length;

  return (
    <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-outline-variant/20 text-on-surface-variant font-mono">
              <th className="w-10 px-3 py-3">
                <button
                  onClick={onToggleSelectAll}
                  className="p-0.5 rounded hover:text-white transition-colors cursor-pointer"
                  title={allSelected ? '取消全选' : '全选'}
                >
                  {allSelected
                    ? <CheckSquare className="w-4 h-4 text-accent-pink" />
                    : <Square className="w-4 h-4 text-on-surface-variant/50" />}
                </button>
              </th>
              <th className="text-left px-5 py-3 font-semibold">角色</th>
              <th className="text-left px-5 py-3 font-semibold">来源</th>
              <th className="text-left px-5 py-3 font-semibold">拥有者</th>
              <th className="text-left px-5 py-3 font-semibold">隐私</th>
              <th className="text-left px-5 py-3 font-semibold">评价</th>
              <th className="text-left px-5 py-3 font-semibold">标签</th>
              <th className="text-right px-5 py-3 font-semibold">大小</th>
              <th className="text-right px-5 py-3 font-semibold">操作</th>
            </tr>
          </thead>
          <tbody>
            {characters.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-on-surface-variant">
                  没有找到匹配的角色
                </td>
              </tr>
            ) : (
              characters.map((char) => {
                const fileName = getFileName(char);
                const charKey = getCharKey(char);
                const isSelected = selectedKeys.has(charKey);
                const isSeed = char._source === 'seed';
                const isPublished = char._source === 'published';
                const privacy = char.privacyType || (isSeed ? 'public' : null);
                const deleteAvatarKey = isPublished ? (char.id || '') : fileName;
                const img = avatarUrl(char);

                return (
                  <tr
                    key={charKey}
                    className={`border-b border-outline-variant/10 transition-colors ${isSelected ? 'bg-accent-pink/5' : 'hover:bg-surface-container/50'}`}
                  >
                    <td className="w-10 px-3 py-3">
                      {!isSeed && (
                        <button
                          onClick={() => onToggleSelect(charKey)}
                          className="p-0.5 rounded hover:text-white transition-colors cursor-pointer"
                        >
                          {isSelected
                            ? <CheckSquare className="w-4 h-4 text-accent-pink" />
                            : <Square className="w-4 h-4 text-on-surface-variant/30" />}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => onOpenDetail(char)}
                        className="flex items-center gap-2.5 text-left cursor-pointer group"
                      >
                        <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center text-[10px] font-bold text-accent-purple overflow-hidden flex-shrink-0">
                          {img ? (
                            <img
                              src={img}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            (char.name?.[0] || '?').toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="text-white font-medium group-hover:text-accent-pink transition-colors">
                            {char.name || '未命名'}
                          </span>
                          {fileName && (
                            <span className="text-on-surface-variant/40 ml-2 text-[10px] font-mono">{fileName}</span>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-surface-elevated border border-outline-variant/20 text-on-surface-variant font-mono">
                        {sourceLabel(char._source)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-on-surface-variant font-mono">{char._owner}</span>
                    </td>
                    <td className="px-5 py-3">
                      {char._source === 'file' ? (
                        <span className="text-[10px] text-on-surface-variant/50">文件</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                            privacy === 'public'
                              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                          }`}
                        >
                          {privacy === 'public' ? '公开' : '私有'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-on-surface-variant font-mono">
                      {typeof char.reviewCount === 'number' ? char.reviewCount : '-'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(char.tags as string[])?.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-surface-elevated/60 border border-outline-variant/20 rounded text-[9px] text-on-surface-variant">
                            {tag}
                          </span>
                        ))}
                        {(char.tags as string[])?.length > 3 && (
                          <span className="text-[9px] text-on-surface-variant/40">
                            +{(char.tags as string[]).length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right text-on-surface-variant/60 font-mono text-[10px]">
                      {char.data_size ? formatSize(char.data_size) : '-'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenDetail(char)}
                          title="查看详情"
                          className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-white hover:bg-surface-elevated cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {isSeed ? (
                          <span className="text-[9px] text-on-surface-variant/30 font-mono italic px-2">只读</span>
                        ) : (
                          <>
                            {isPublished && (
                              <button
                                onClick={() => onTogglePrivacy(char)}
                                disabled={privacyPending || !char.id}
                                title={privacy === 'public' ? '下架（设为私有）' : '上架（设为公开）'}
                                className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30 cursor-pointer transition-colors"
                              >
                                {privacy === 'public' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <button
                              onClick={() => onEdit(char)}
                              title="编辑角色"
                              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-accent-pink hover:bg-accent-pink/10 cursor-pointer transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {confirmDelete &&
                            confirmDelete.owner === char._owner &&
                            confirmDelete.avatar === deleteAvatarKey ? (
                              <>
                                <button
                                  onClick={onConfirmDelete}
                                  disabled={deletePending}
                                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer"
                                  title="确认删除"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={onCancelDelete}
                                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-white cursor-pointer"
                                  title="取消"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => onRequestDelete(char)}
                                title="删除角色"
                                className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
