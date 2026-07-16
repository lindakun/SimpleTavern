import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAllCharacters,
  useAdminDeleteCharacter,
  useAdminDeletePublished,
  useAdminEditCharacter,
  useAdminImportUgirl,
  useAdminSetPrivacy,
  useAdminDeleteReview,
  useUsers,
  characterKeys,
} from '../hooks/useAdminApi';
import { adminApi } from '../api/admin';
import {
  Search, Trash2, X, Check, User, Pencil, Upload, ChevronDown, ChevronRight,
  Folder, Square, CheckSquare, Loader, Eye, Lock, Unlock, Star,
} from 'lucide-react';
import type {
  AdminCharacterItem,
  UgirlImportResult,
  AdminCharacterDetailResponse,
  AdminReviewItem,
} from '../types';

export default function Characters() {
  const qc = useQueryClient();
  const { data: characters = [], isLoading, error } = useAllCharacters();
  const { data: users = [] } = useUsers();
  const deleteChar = useAdminDeleteCharacter();
  const deletePublished = useAdminDeletePublished();
  const editChar = useAdminEditCharacter();
  const setPrivacy = useAdminSetPrivacy();

  // 批量导入状态
  const importUgirl = useAdminImportUgirl();
  const [showImport, setShowImport] = useState(false);
  const [importHandle, setImportHandle] = useState('admin');
  const [importFilePath, setImportFilePath] = useState('');
  const [importResult, setImportResult] = useState<UgirlImportResult | null>(null);

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
  const [privacyFilter, setPrivacyFilter] = useState<'ALL' | 'public' | 'private'>('ALL');
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ owner: string; avatar: string; name: string; source: string } | null>(null);
  const [editingChar, setEditingChar] = useState<AdminCharacterItem | null>(null);
  const [detailChar, setDetailChar] = useState<AdminCharacterItem | null>(null);

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
      if (privacyFilter !== 'ALL') {
        const p = c.privacyType || (c._source === 'seed' ? 'public' : 'private');
        if (p !== privacyFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!c.name?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [characters, ownerFilter, tagFilter, privacyFilter, search]);

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

    let completed = 0;
    const promises = targets.map(async (c) => {
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
      completed++;
      setBatchDeleteProgress({ current: completed, total: targets.length });
    });

    await Promise.allSettled(promises);

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

        <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-1.5">
          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value as 'ALL' | 'public' | 'private')}
            className="bg-transparent text-xs text-white outline-none cursor-pointer"
          >
            <option value="ALL">全部隐私</option>
            <option value="public">仅公开</option>
            <option value="private">仅私有</option>
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
            <Upload className="w-4 h-4 text-accent-pink" />
            <span className="font-semibold">批量导入 ugirl 角色</span>
            <span className="text-[10px] text-on-surface-variant/50 font-normal">
              从服务器 JSON 文件批量导入角色卡
            </span>
          </div>
          {showImport ? <ChevronDown className="w-4 h-4 text-on-surface-variant/50" /> : <ChevronRight className="w-4 h-4 text-on-surface-variant/50" />}
        </button>

        {showImport && (
          <div className="px-5 pb-5 space-y-4">
            {/* 目标用户选择 */}
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

            {/* JSON 文件路径 */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-on-surface-variant ml-1">
                JSON 文件路径 <span className="text-on-surface-variant/40 font-normal">（服务器上的绝对路径，头像目录自动从同级 avatars_processed 解析）</span>
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-2">
                  <Folder className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
                  <input
                    type="text"
                    value={importFilePath}
                    onChange={(e) => {
                      setImportFilePath(e.target.value);
                      setImportResult(null);
                    }}
                    placeholder="/home/user/ugirl_craw/output/ugirl_recommended_all_processed.json"
                    className="bg-transparent text-xs text-white outline-none w-full placeholder:text-on-surface-variant/30"
                  />
                </div>
                <button
                  onClick={async () => {
                    const trimmed = importFilePath.trim();
                    if (!trimmed) return;

                    setImportResult(null);
                    try {
                      const result = await importUgirl.mutateAsync({
                        filePath: trimmed,
                        handle: importHandle,
                      });
                      setImportResult(result as UgirlImportResult);
                    } catch {
                      // error handled by mutation
                    }
                  }}
                  disabled={importUgirl.isPending || !importFilePath.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  {importUgirl.isPending ? '导入中...' : '开始导入'}
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant/40 ml-1">
                头像将从 JSON 文件所在目录及同级 <code className="text-accent-pink/60">avatars_processed/</code> 目录自动查找
              </p>
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
                  <th className="text-left px-5 py-3 font-semibold">隐私</th>
                  <th className="text-left px-5 py-3 font-semibold">标签</th>
                  <th className="text-right px-5 py-3 font-semibold">大小</th>
                  <th className="text-right px-5 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-on-surface-variant">
                      没有找到匹配的角色
                    </td>
                  </tr>
                ) : (
                  filtered.map((char) => {
                    const fileName = getFileName(char);
                    const charKey = getCharKey(char);
                    const isSelected = selectedKeys.has(charKey);
                    const isSeed = char._source === 'seed';
                    const isPublished = char._source === 'published';
                    const privacy = char.privacyType || (isSeed ? 'public' : 'private');
                    const deleteAvatarKey = isPublished ? (char.id || '') : fileName;
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
                        <button
                          onClick={() => setDetailChar(char)}
                          className="flex items-center gap-2.5 text-left cursor-pointer group"
                        >
                          <div className="w-7 h-7 rounded-lg bg-accent-purple/15 flex items-center justify-center text-[10px] font-bold text-accent-purple overflow-hidden flex-shrink-0">
                            {char.avatar && !char.avatar.startsWith('data:') && char.avatar.startsWith('http') ? (
                              <img src={char.avatar} alt="" className="w-full h-full object-cover" />
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
                        <span className="text-on-surface-variant font-mono">{char._owner}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                            privacy === 'public'
                              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                              : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-400'
                          }`}
                        >
                          {privacy === 'public' ? '公开' : '私有'}
                        </span>
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
                          <button
                            onClick={() => setDetailChar(char)}
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
                                  onClick={() =>
                                    setPrivacy.mutate({
                                      handle: char._owner,
                                      characterId: char.id || '',
                                      privacyType: privacy === 'public' ? 'private' : 'public',
                                      source: 'published',
                                    })
                                  }
                                  disabled={setPrivacy.isPending || !char.id}
                                  title={privacy === 'public' ? '下架（设为私有）' : '上架（设为公开）'}
                                  className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30 cursor-pointer transition-colors"
                                >
                                  {privacy === 'public' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              <button
                                onClick={() => setEditingChar(char)}
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
                                    onClick={handleDelete}
                                    disabled={deleteChar.isPending || deletePublished.isPending}
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
                                      avatar: deleteAvatarKey,
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
          onSave={async (name, tags, description) => {
            const source = (editingChar._source || 'file') as 'published' | 'file';
            await editChar.mutateAsync({
              handle: editingChar._owner,
              source,
              avatar_url: source === 'file' ? getFileName(editingChar) : undefined,
              characterId: source === 'published' ? editingChar.id : undefined,
              name,
              tags,
              description,
            });
            setEditingChar(null);
          }}
          onClose={() => setEditingChar(null)}
          isPending={editChar.isPending}
        />
      )}

      {/* 详情抽屉 */}
      {detailChar && (
        <CharacterDetailDrawer
          char={detailChar}
          fileName={getFileName(detailChar)}
          onClose={() => setDetailChar(null)}
          onEdit={() => {
            if (detailChar._source !== 'seed') {
              setEditingChar(detailChar);
              setDetailChar(null);
            }
          }}
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
  onSave: (name: string, tags: string[], description: string) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(char.name || '');
  const [tagsStr, setTagsStr] = useState(Array.isArray(char.tags) ? char.tags.join(', ') : '');
  const [description, setDescription] = useState(char.description || '');
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
    await onSave(name.trim(), tags, description);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 flex-shrink-0">
          <h2 className="text-sm font-bold text-white font-mono">编辑角色</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3 pb-2 border-b border-outline-variant/10">
            <span className="text-xs text-on-surface-variant font-mono">拥有者: {char._owner}</span>
            <span className="text-[10px] text-on-surface-variant/40 font-mono">{fileName || char.id}</span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">角色名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-accent-pink transition-colors"
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
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-accent-pink transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-accent-pink transition-colors resize-y"
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

function CharacterDetailDrawer({
  char,
  fileName,
  onClose,
  onEdit,
}: {
  char: AdminCharacterItem;
  fileName: string;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [detail, setDetail] = useState<AdminCharacterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const deleteReview = useAdminDeleteReview();
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const source = (char._source || 'file') as 'seed' | 'published' | 'file';
    adminApi
      .getCharacterDetail({
        source,
        handle: source === 'seed' ? undefined : char._owner,
        characterId: source === 'seed' || source === 'published' ? char.id : undefined,
        avatar_url: source === 'file' ? fileName : undefined,
      })
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setReviews(data.reviews || []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [char, fileName]);

  const c = detail?.character || char;
  const readonly = detail?.readonly ?? char._source === 'seed';

  const handleDeleteReview = async (r: AdminReviewItem) => {
    try {
      await deleteReview.mutateAsync({
        store: r.store,
        characterKey: r.characterKey,
        reviewId: r.id,
      });
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
    } catch {
      /* mutation surfaces error */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border-l border-outline-variant/20 h-full overflow-y-auto animate-subtle-fadeIn">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-outline-variant/20 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-mono">{c.name || '角色详情'}</h2>
            <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">
              {c._owner} · {c._source}
              {readonly ? ' · 只读' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!readonly && (
              <button
                onClick={onEdit}
                className="px-3 py-1.5 text-[11px] text-accent-pink border border-accent-pink/30 rounded-lg hover:bg-accent-pink/10 cursor-pointer"
              >
                编辑
              </button>
            )}
            <button onClick={onClose} className="p-1.5 text-on-surface-variant hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <Loader className="w-4 h-4 animate-spin" /> 加载详情...
            </div>
          )}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">{error}</div>
          )}

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono">基础信息</h3>
            <div className="bg-surface-container/40 border border-outline-variant/15 rounded-xl p-4 space-y-2 text-xs">
              <Row label="隐私" value={String(c.privacyType || (c._source === 'seed' ? 'public' : '-'))} />
              <Row label="标签" value={Array.isArray(c.tags) ? c.tags.join(', ') || '-' : '-'} />
              <Row label="文件" value={fileName || c.id || '-'} />
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono">描述</h3>
            <p className="text-xs text-white/80 whitespace-pre-wrap leading-relaxed bg-surface-container/40 border border-outline-variant/15 rounded-xl p-4">
              {c.description || '（无）'}
            </p>
          </section>

          {(c.personality || c.scenario || c.first_mes) && (
            <section className="space-y-3">
              {c.personality ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono mb-1">性格</h3>
                  <p className="text-xs text-white/70 whitespace-pre-wrap bg-surface-container/40 rounded-xl p-3 border border-outline-variant/15">
                    {String(c.personality).slice(0, 800)}
                  </p>
                </div>
              ) : null}
              {c.scenario ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono mb-1">场景</h3>
                  <p className="text-xs text-white/70 whitespace-pre-wrap bg-surface-container/40 rounded-xl p-3 border border-outline-variant/15">
                    {String(c.scenario).slice(0, 800)}
                  </p>
                </div>
              ) : null}
              {c.first_mes ? (
                <div>
                  <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono mb-1">开场白</h3>
                  <p className="text-xs text-white/70 whitespace-pre-wrap bg-surface-container/40 rounded-xl p-3 border border-outline-variant/15">
                    {String(c.first_mes).slice(0, 800)}
                  </p>
                </div>
              ) : null}
            </section>
          )}

          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono flex items-center gap-1.5">
              <Star className="w-3 h-3 text-accent-pink" />
              评价 ({reviews.length})
            </h3>
            {reviews.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">暂无评价</p>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="bg-surface-container/40 border border-outline-variant/15 rounded-xl p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-white font-medium">{r.username}</span>
                        <span className="text-yellow-400 font-mono">{r.rating}★</span>
                        <span className="text-on-surface-variant/50 font-mono">{r.date}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteReview(r)}
                        disabled={deleteReview.isPending}
                        title="删除评价"
                        className="p-1 rounded text-on-surface-variant/40 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <p className="text-xs text-white/75 whitespace-pre-wrap">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-on-surface-variant w-12 flex-shrink-0">{label}</span>
      <span className="text-white break-all">{value}</span>
    </div>
  );
}
