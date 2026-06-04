import { useState, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllCharacters,
  useAdminDeleteCharacter,
  useAdminDeletePublished,
  useAdminEditCharacter,
  useAdminImportUgirl,
  useUsers,
  characterKeys,
} from '../hooks/useAdminApi';
import { Search, Trash2, X, Check, User, Pencil, Upload, ChevronDown, ChevronRight, Download, Folder, Square, CheckSquare, Loader } from 'lucide-react';
import type { AdminCharacterItem, UgirlImportResult } from '../types';

export default function Characters() {
  const qc = useQueryClient();
  const { data: characters = [], isLoading, error } = useAllCharacters();
  const { data: users = [] } = useUsers();
  const deleteChar = useAdminDeleteCharacter();
  const deletePublished = useAdminDeletePublished();
  const editChar = useAdminEditCharacter();

  // 批量导入状态
  const importUgirl = useAdminImportUgirl();
  const [showImport, setShowImport] = useState(false);
  const [importHandle, setImportHandle] = useState('admin');
  const [importAvatarsDir, setImportAvatarsDir] = useState('/ugirl_avatars');
  const [importResult, setImportResult] = useState<UgirlImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 批量删除状态
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState({ current: 0, total: 0 });

  // 获取角色的唯一键
  const getCharKey = (c: AdminCharacterItem): string => {
    const fileName = getFileName(c);
    return `${c._owner}|${c._source}|${fileName || c.id || ''}`;
  };

  // 过滤条件
  const [ownerFilter, setOwnerFilter] = useState('ALL');
  const [tagFilter, setTagFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ owner: string; avatar: string; name: string; source: string } | null>(null);
  const [editingChar, setEditingChar] = useState<AdminCharacterItem | null>(null);

  // 提取所有唯一标签
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const c of characters) {
      if (Array.isArray(c.tags)) {
        for (const t of c.tags) tags.add(t);
      }
    }
    return ['ALL', ...Array.from(tags).sort()];
  }, [characters]);

  // 过滤后的角色列表
  const filtered = useMemo(() => {
    return characters.filter((c) => {
      if (ownerFilter !== 'ALL' && c._owner !== ownerFilter) return false;
      if (tagFilter !== 'ALL' && (!Array.isArray(c.tags) || !c.tags.includes(tagFilter))) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [characters, ownerFilter, tagFilter, search]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.source === 'published') {
        await deletePublished.mutateAsync({
          handle: confirmDelete.owner,
          characterId: confirmDelete.avatar, // published uses characterId
        });
      } else {
        await deleteChar.mutateAsync({
          handle: confirmDelete.owner,
          avatar_url: confirmDelete.avatar,
        });
      }
      setConfirmDelete(null);
    } catch { /* error handled by hook */ }
  };

  // 获取角色的 PNG 文件名（只显示 .png 的实际文件，不显示 URL）
  const getFileName = (c: AdminCharacterItem) => {
    const name = c._fileName || c.avatar || '';
    if (name.endsWith('.png')) return name;
    return '';
  };

  // 复选框处理
  const toggleSelect = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === filtered.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(filtered.map(getCharKey)));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    const targets = filtered.filter(c => selectedKeys.has(getCharKey(c)));
    setBatchDeleting(true);
    setBatchDeleteProgress({ current: 0, total: targets.length });

    for (let i = 0; i < targets.length; i++) {
      const c = targets[i];
      const fileName = getFileName(c);
      try {
        if (c._source === 'published') {
          await deletePublished.mutateAsync({
            handle: c._owner,
            characterId: c.id || fileName,
          });
        } else {
          await deleteChar.mutateAsync({
            handle: c._owner,
            avatar_url: fileName,
          });
        }
      } catch (err) {
        console.error('[批量删除] 删除角色失败:', c.name, err);
      }
      setBatchDeleteProgress({ current: i + 1, total: targets.length });
    }

    setSelectedKeys(new Set());
    setBatchDeleting(false);
    setBatchDeleteConfirm(false);
    qc.invalidateQueries({ queryKey: characterKeys.all });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-wider">角色管理</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          {isLoading ? '加载中...' : `共 ${filtered.length} / ${characters.length} 个角色`}
        </p>
      </div>

      {/* 过滤条件 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
          <User className="w-3.5 h-3.5 text-on-surface-variant/60" />
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
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
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="bg-transparent text-xs text-white outline-none cursor-pointer"
          >
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag === 'ALL' ? '全部标签' : tag}
              </option>
            ))}
          </select>
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="按角色名称搜索..."
            className="w-full bg-surface-container border border-outline-variant/30 rounded-xl py-1.5 pl-9 pr-4 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
          />
        </div>
      </div>

      {/* 批量导入 ugirl 角色 */}
      <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowImport(!showImport)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm text-white font-mono hover:bg-surface-container/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-accent-pink" />
            <span className="font-semibold">批量导入 ugirl 角色</span>
            <span className="text-[10px] text-on-surface-variant/50 font-normal">
              从 JSON 文件批量导入角色卡
            </span>
          </div>
          {showImport ? <ChevronDown className="w-4 h-4 text-on-surface-variant/50" /> : <ChevronRight className="w-4 h-4 text-on-surface-variant/50" />}
        </button>

        {showImport && (
          <div className="px-5 pb-5 space-y-4">
            {/* 目标用户选择 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-on-surface-variant ml-1">
                  导入到用户
                </label>
                <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-2">
                  <User className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
                  <select
                    value={importHandle}
                    onChange={(e) => setImportHandle(e.target.value)}
                    className="bg-transparent text-xs text-white outline-none cursor-pointer w-full"
                  >
                    {users.map((u) => (
                      <option key={u.handle} value={u.handle}>{u.handle}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[11px] font-semibold text-on-surface-variant ml-1">
                  头像目录 <span className="text-on-surface-variant/40 font-normal">（可选，服务器路径）</span>
                </label>
                <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-2">
                  <Folder className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
                  <input
                    type="text"
                    value={importAvatarsDir}
                    onChange={(e) => setImportAvatarsDir(e.target.value)}
                    placeholder="/path/to/test_avatars"
                    className="bg-transparent text-xs text-white outline-none w-full placeholder:text-on-surface-variant/30"
                  />
                </div>
              </div>
            </div>

            {/* 文件上传 + 操作按钮 */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={() => {
                    // 清空上次结果
                    setImportResult(null);
                  }}
                  className="w-full text-xs text-on-surface-variant file:mr-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-accent-purple/20 file:text-accent-pink file:cursor-pointer hover:file:bg-accent-purple/30 transition-colors file:transition-colors cursor-pointer"
                />
              </div>
              <button
                onClick={async () => {
                  const file = fileInputRef.current?.files?.[0];
                  if (!file) return;

                  setImportResult(null);
                  try {
                    const result = await importUgirl.mutateAsync({
                      file,
                      handle: importHandle,
                      avatarsDir: importAvatarsDir.trim() || undefined,
                    });
                    setImportResult(result as UgirlImportResult);
                    // 重置文件输入
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  } catch {
                    // error handled by mutation
                  }
                }}
                disabled={importUgirl.isPending}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {importUgirl.isPending ? '导入中...' : '开始导入'}
              </button>
            </div>

            {/* 导入进度提示 */}
            {importUgirl.isPending && (
              <div className="flex items-center gap-3 bg-accent-pink/5 border border-accent-pink/20 rounded-xl px-4 py-3">
                <div className="w-4 h-4 border-2 border-accent-pink border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-accent-pink">正在导入角色，请稍候...</span>
              </div>
            )}

            {/* 导入错误 */}
            {importUgirl.isError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
                导入失败：{(importUgirl.error as Error).message}
              </div>
            )}

            {/* 导入结果 */}
            {importResult && (
              <div className="bg-surface-elevated/40 border border-outline-variant/20 rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 px-4 py-3 border-b border-outline-variant/10">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant">总计</span>
                    <span className="text-sm font-bold text-white">{importResult.total}</span>
                  </div>
                  <div className="w-px h-4 bg-outline-variant/20" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant">成功</span>
                    <span className="text-sm font-bold text-green-400">{importResult.success}</span>
                  </div>
                  <div className="w-px h-4 bg-outline-variant/20" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant">失败</span>
                    <span className={`text-sm font-bold ${importResult.failed > 0 ? 'text-red-400' : 'text-on-surface-variant'}`}>{importResult.failed}</span>
                  </div>
                </div>

                {/* 失败详情 */}
                {importResult.failed > 0 && (
                  <div className="divide-y divide-outline-variant/10 max-h-48 overflow-y-auto">
                    {importResult.results.filter(r => r.status === 'failed').map((r, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                        <X className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="text-xs text-white">{r.name}</span>
                          <p className="text-[10px] text-red-400/70 mt-0.5">{r.error}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 成功列表（折叠） */}
                {importResult.success > 0 && (
                  <details className="border-t border-outline-variant/10">
                    <summary className="px-4 py-2.5 text-[11px] text-on-surface-variant hover:text-white cursor-pointer">
                      查看导入成功的角色 ({importResult.success})
                    </summary>
                    <div className="divide-y divide-outline-variant/10 max-h-48 overflow-y-auto">
                      {importResult.results.filter(r => r.status === 'success').map((r, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2">
                          <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
                          <span className="text-xs text-white">{r.name}</span>
                          <span className="text-[10px] text-on-surface-variant/40 font-mono ml-auto">{r.fileName}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 批量操作栏 */}
      {selectedKeys.size > 0 && !batchDeleting && (
        <div className="flex items-center justify-between bg-accent-pink/10 border border-accent-pink/25 rounded-xl px-5 py-2.5">
          <span className="text-xs text-white">
            已选择 <span className="text-accent-pink font-bold">{selectedKeys.size}</span> 个角色
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedKeys(new Set())}
              className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              取消选择
            </button>
            <button
              onClick={() => setBatchDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold rounded-xl hover:bg-red-500/30 active:scale-95 transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除所选
            </button>
          </div>
        </div>
      )}

      {/* 批量删除进度 */}
      {batchDeleting && (
        <div className="flex items-center gap-3 bg-accent-pink/5 border border-accent-pink/20 rounded-xl px-4 py-3">
          <Loader className="w-4 h-4 text-accent-pink animate-spin" />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white">正在删除...</span>
              <span className="text-[10px] text-on-surface-variant font-mono">
                {batchDeleteProgress.current} / {batchDeleteProgress.total}
              </span>
            </div>
            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-pink to-accent-purple rounded-full transition-all duration-300"
                style={{
                  width: `${batchDeleteProgress.total > 0
                    ? (batchDeleteProgress.current / batchDeleteProgress.total) * 100
                    : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {/* 角色列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-container/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant font-mono">
                  <th className="w-10 px-3 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className="p-0.5 rounded hover:text-white transition-colors cursor-pointer"
                      title={selectedKeys.size === filtered.length ? '取消全选' : '全选'}
                    >
                      {selectedKeys.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4 text-accent-pink" />
                        : <Square className="w-4 h-4 text-on-surface-variant/50" />
                      }
                    </button>
                  </th>
                  <th className="text-left px-5 py-3 font-semibold">角色名称</th>
                  <th className="text-left px-5 py-3 font-semibold">拥有者</th>
                  <th className="text-left px-5 py-3 font-semibold">标签</th>
                  <th className="text-right px-5 py-3 font-semibold">大小</th>
                  <th className="text-right px-5 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-on-surface-variant">
                      没有找到匹配的角色
                    </td>
                  </tr>
                ) : (
                  filtered.map((char) => {
                    const fileName = getFileName(char);
                    const charKey = getCharKey(char);
                    const isSelected = selectedKeys.has(charKey);
                    const isSeed = char._source === 'seed';
                    return (
                    <tr
                      key={charKey}
                      className={`border-b border-outline-variant/10 transition-colors ${isSelected ? 'bg-accent-pink/5' : 'hover:bg-surface-container/50'}`}
                    >
                      <td className="w-10 px-3 py-3">
                        {!isSeed && (
                          <button
                            onClick={() => toggleSelect(charKey)}
                            className="p-0.5 rounded hover:text-white transition-colors cursor-pointer"
                          >
                            {isSelected
                              ? <CheckSquare className="w-4 h-4 text-accent-pink" />
                              : <Square className="w-4 h-4 text-on-surface-variant/30" />
                            }
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center text-[10px] font-bold text-accent-purple overflow-hidden flex-shrink-0">
                            {char.avatar && !char.avatar.startsWith('data:') && char.avatar.startsWith('http') ? (
                              <img src={char.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (char.name?.[0] || '?').toUpperCase()
                            )}
                          </div>
                          <div>
                            <span className="text-white font-medium">{char.name || '未命名'}</span>
                            {fileName && (
                              <span className="text-on-surface-variant/40 ml-2 text-[10px] font-mono">{fileName}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-on-surface-variant font-mono">{char._owner}</span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(char.tags as string[])?.slice(0, 4).map((tag: string) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-surface-elevated/60 border border-outline-variant/20 rounded text-[9px] text-on-surface-variant">
                              {tag}
                            </span>
                          ))}
                          {(char.tags as string[])?.length > 4 && (
                            <span className="text-[9px] text-on-surface-variant/40">
                              +{(char.tags as string[]).length - 4}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-on-surface-variant/60 font-mono text-[10px]">
                        {char.data_size ? formatSize(char.data_size) : '-'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isSeed ? (
                            <span className="text-[9px] text-on-surface-variant/30 font-mono italic px-2">内置</span>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingChar(char)}
                                title="编辑角色"
                                className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-accent-pink hover:bg-accent-pink/10 cursor-pointer transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>

                              {confirmDelete &&
                               confirmDelete.owner === char._owner &&
                               confirmDelete.avatar === fileName ? (
                                <>
                                  <button
                                    onClick={handleDelete}
                                    disabled={deleteChar.isPending}
                                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer"
                                    title="确认删除"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => setConfirmDelete(null)}
                                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-white cursor-pointer"
                                    title="取消"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() =>
                                    setConfirmDelete({
                                      owner: char._owner,
                                      avatar: char._source === 'published' ? (char.id || '') : fileName,
                                      name: char.name || fileName,
                                      source: char._source || 'file',
                                    })
                                  }
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
      )}

      {/* 批量删除确认弹窗 */}
      {batchDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-outline-variant/20">
              <h2 className="text-sm font-bold text-white font-mono">确认批量删除</h2>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-white font-medium">确定删除 {selectedKeys.size} 个角色？</p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    此操作不可撤销，角色及其聊天记录将被永久删除。
                  </p>
                </div>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1 bg-surface-container/30 rounded-xl p-3">
                {filtered
                  .filter(c => selectedKeys.has(getCharKey(c)))
                  .slice(0, 20)
                  .map(c => (
                    <div key={getCharKey(c)} className="text-xs text-on-surface-variant font-mono flex items-center gap-2">
                      <X className="w-3 h-3 text-red-400/60 flex-shrink-0" />
                      <span className="truncate">{c.name || '未命名'}</span>
                      <span className="text-[10px] text-on-surface-variant/30 ml-auto">{c._owner}</span>
                    </div>
                  ))}
                {selectedKeys.size > 20 && (
                  <div className="text-xs text-on-surface-variant/40 text-center pt-1">
                    ...及其他 {selectedKeys.size - 20} 个
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setBatchDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold rounded-xl hover:bg-red-500/30 active:scale-95 transition-all cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editingChar && (
        <EditModal
          char={editingChar}
          fileName={getFileName(editingChar)}
          onSave={async (name, tags) => {
            await editChar.mutateAsync({
              handle: editingChar._owner,
              avatar_url: getFileName(editingChar),
              name,
              tags,
            });
            setEditingChar(null);
          }}
          onClose={() => setEditingChar(null)}
          isPending={editChar.isPending}
        />
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function EditModal({
  char,
  fileName,
  onSave,
  onClose,
  isPending,
}: {
  char: AdminCharacterItem;
  fileName: string;
  onSave: (name: string, tags: string[]) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(char.name || '');
  const [tagsStr, setTagsStr] = useState(Array.isArray(char.tags) ? char.tags.join(', ') : '');
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim()) {
      setError('角色名称不能为空');
      return;
    }
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    await onSave(name.trim(), tags);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <h2 className="text-sm font-bold text-white font-mono">编辑角色</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/10">
            <span className="text-xs text-on-surface-variant font-mono">拥有者: {char._owner}</span>
            <span className="text-[10px] text-on-surface-variant/40 font-mono">{fileName}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">角色名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">
              标签 <span className="text-on-surface-variant/40 font-normal">（逗号分隔）</span>
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="傲娇, 治愈, 赛博朋克"
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex-1 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isPending ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
