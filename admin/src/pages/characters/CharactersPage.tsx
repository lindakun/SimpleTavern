import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useQueryCharacters,
  useAdminDeleteCharacter,
  useAdminDeletePublished,
  useAdminEditCharacter,
  useAdminSetPrivacy,
  useUsers,
  characterKeys,
} from '../../hooks/useAdminApi';
import type { AdminCharacterItem } from '../../types';
import CharacterFilters, { type CharacterFilterState } from './CharacterFilters';
import CharacterTable from './CharacterTable';
import CharacterDetailDrawer from './CharacterDetailDrawer';
import CharacterEditModal, { type CharacterEditPayload } from './CharacterEditModal';
import UgirlImportPanel from './UgirlImportPanel';
import PngImportPanel from './PngImportPanel';
import BatchActionBar from './BatchActionBar';
import { getCharKey, getFileName } from './utils';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

const PAGE_SIZE = 50;

export default function CharactersPage() {
  const qc = useQueryClient();
  const { data: users = [] } = useUsers();
  const deleteChar = useAdminDeleteCharacter();
  const deletePublished = useAdminDeletePublished();
  const editChar = useAdminEditCharacter();
  const setPrivacy = useAdminSetPrivacy();

  const [filters, setFilters] = useState<CharacterFilterState>({
    owner: 'ALL',
    source: 'all',
    privacy: 'all',
    tag: 'ALL',
    q: '',
    sort: 'name',
    order: 'asc',
  });
  const [page, setPage] = useState(1);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [batchDeleting, setBatchDeleting] = useState(false);
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [batchDeleteProgress, setBatchDeleteProgress] = useState({ current: 0, total: 0 });
  const [confirmDelete, setConfirmDelete] = useState<{
    owner: string;
    avatar: string;
    name: string;
    source: string;
  } | null>(null);
  const [editingChar, setEditingChar] = useState<AdminCharacterItem | null>(null);
  const [detailChar, setDetailChar] = useState<AdminCharacterItem | null>(null);

  // 防抖感：筛选变化重置页码
  const queryParams = useMemo(
    () => ({
      handle: filters.owner === 'ALL' ? undefined : filters.owner,
      source: filters.source,
      privacy: filters.privacy,
      tag: filters.tag === 'ALL' ? undefined : filters.tag,
      q: filters.q.trim() || undefined,
      sort: filters.sort,
      order: filters.order,
      page,
      pageSize: PAGE_SIZE,
    }),
    [filters, page],
  );

  const { data, isLoading, error, isFetching } = useQueryCharacters(queryParams);
  const characters = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 标签选项：当前页 + 简单从结果提取（完整标签可后续服务端返回）
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const c of characters) {
      if (Array.isArray(c.tags)) for (const t of c.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }, [characters]);

  const handleFilterChange = (next: CharacterFilterState) => {
    setFilters(next);
    setPage(1);
    setSelectedKeys(new Set());
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.source === 'published') {
        await deletePublished.mutateAsync({
          handle: confirmDelete.owner,
          characterId: confirmDelete.avatar,
        });
      } else {
        await deleteChar.mutateAsync({
          handle: confirmDelete.owner,
          avatar_url: confirmDelete.avatar,
        });
      }
      setConfirmDelete(null);
    } catch {
      /* handled */
    }
  };

  const handleBatchDelete = async () => {
    const targets = characters.filter((c) => selectedKeys.has(getCharKey(c)));
    setBatchDeleting(true);
    setBatchDeleteProgress({ current: 0, total: targets.length });
    let completed = 0;
    await Promise.allSettled(
      targets.map(async (c) => {
        try {
          if (c._source === 'published') {
            await deletePublished.mutateAsync({
              handle: c._owner,
              characterId: c.id || '',
            });
          } else if (c._source !== 'seed') {
            await deleteChar.mutateAsync({
              handle: c._owner,
              avatar_url: getFileName(c),
            });
          }
        } catch {
          /* continue */
        }
        completed += 1;
        setBatchDeleteProgress({ current: completed, total: targets.length });
      }),
    );
    setSelectedKeys(new Set());
    setBatchDeleting(false);
    setBatchDeleteConfirm(false);
    qc.invalidateQueries({ queryKey: characterKeys.all });
  };

  const handleEditSave = async (payload: CharacterEditPayload) => {
    if (!editingChar) return;
    const source = (editingChar._source || 'file') as 'published' | 'file';
    await editChar.mutateAsync({
      handle: editingChar._owner,
      source,
      avatar_url: source === 'file' ? getFileName(editingChar) : undefined,
      characterId: source === 'published' ? editingChar.id : undefined,
      ...payload,
    });
    setEditingChar(null);
  };

  const handleTogglePrivacy = (c: AdminCharacterItem) => {
    if (c._source !== 'published' || !c.id) return;
    const privacy = c.privacyType || 'private';
    setPrivacy.mutate({
      handle: c._owner,
      characterId: c.id,
      privacyType: privacy === 'public' ? 'private' : 'public',
      source: 'published',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-wider">角色管理</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          {isLoading ? '加载中...' : `共 ${total} 个角色 · 第 ${page}/${totalPages} 页`}
          {isFetching && !isLoading ? ' · 刷新中…' : ''}
        </p>
      </div>

      <CharacterFilters
        value={filters}
        onChange={handleFilterChange}
        users={users}
        allTags={allTags}
      />

      <div className="space-y-3">
        <PngImportPanel users={users} />
        <UgirlImportPanel users={users} />
      </div>

      <BatchActionBar
        selectedCount={selectedKeys.size}
        batchDeleting={batchDeleting}
        progress={batchDeleteProgress}
        onClear={() => setSelectedKeys(new Set())}
        onConfirmDelete={() => setBatchDeleteConfirm(true)}
      />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-container/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <CharacterTable
          characters={characters}
          selectedKeys={selectedKeys}
          confirmDelete={confirmDelete}
          onToggleSelect={(key) => {
            setSelectedKeys((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            });
          }}
          onToggleSelectAll={() => {
            if (selectedKeys.size === characters.length) setSelectedKeys(new Set());
            else setSelectedKeys(new Set(characters.map(getCharKey)));
          }}
          onOpenDetail={setDetailChar}
          onEdit={setEditingChar}
          onTogglePrivacy={handleTogglePrivacy}
          onRequestDelete={(c) =>
            setConfirmDelete({
              owner: c._owner,
              avatar: c._source === 'published' ? (c.id || '') : getFileName(c),
              name: c.name || '',
              source: c._source || 'file',
            })
          }
          onConfirmDelete={handleDelete}
          onCancelDelete={() => setConfirmDelete(null)}
          deletePending={deleteChar.isPending || deletePublished.isPending}
          privacyPending={setPrivacy.isPending}
        />
      )}

      {/* 分页 */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-on-surface-variant font-mono">
            显示 {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-white font-mono px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

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
                  <p className="text-xs text-on-surface-variant mt-1">此操作不可撤销。种子角色不会被删除。</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setBatchDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchDelete}
                  className="flex-1 py-2.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold rounded-xl cursor-pointer"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingChar && (
        <CharacterEditModal
          char={editingChar}
          onSave={handleEditSave}
          onClose={() => setEditingChar(null)}
          isPending={editChar.isPending}
        />
      )}

      {detailChar && (
        <CharacterDetailDrawer
          char={detailChar}
          onClose={() => setDetailChar(null)}
          onEdit={() => {
            if (detailChar._source !== 'seed') {
              setEditingChar(detailChar);
              setDetailChar(null);
            }
          }}
          onTogglePrivacy={
            detailChar._source === 'published'
              ? () => handleTogglePrivacy(detailChar)
              : undefined
          }
          privacyPending={setPrivacy.isPending}
        />
      )}
    </div>
  );
}
