import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, BookOpen, Plus, Trash2, Save, Upload,
  Edit3, ChevronDown, ChevronRight, X, Search, FileJson,
  Eye, EyeOff, Copy, AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ScreenId } from '../types';
import { useWorldApi, WorldListItem, WorldBookData, WorldEntry, createEmptyEntry } from '../api/worlds';
import { useToast } from './Toast';

interface WorldBookManageScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

// ── 条目编辑器字段组 ──

interface EntryFormData {
  comment: string;
  content: string;
  key: string;
  keysecondary: string;
  constant: boolean;
  disable: boolean;
  position: number;
  order: number;
  depth: number;
  selective: boolean;
  selectiveLogic: number;
  probability: number;
  useProbability: boolean;
  group: string;
  groupWeight: number;
  groupOverride: boolean;
  addMemo: boolean;
  ignoreBudget: boolean;
  excludeRecursion: boolean;
  preventRecursion: boolean;
  delayUntilRecursion: number;
  role: number;
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  useGroupScoring: boolean | null;
  automationId: string;
  outletName: string;
  vectorized: boolean;
}

function entryToFormData(entry: WorldEntry): EntryFormData {
  return {
    comment: entry.comment ?? '',
    content: entry.content ?? '',
    key: (entry.key ?? []).join(', '),
    keysecondary: (entry.keysecondary ?? []).join(', '),
    constant: entry.constant ?? false,
    disable: entry.disable ?? false,
    position: entry.position ?? 0,
    order: entry.order ?? 100,
    depth: entry.depth ?? 4,
    selective: entry.selective ?? false,
    selectiveLogic: entry.selectiveLogic ?? 0,
    probability: entry.probability ?? 100,
    useProbability: entry.useProbability ?? true,
    group: entry.group ?? '',
    groupWeight: entry.groupWeight ?? 100,
    groupOverride: entry.groupOverride ?? false,
    addMemo: entry.addMemo ?? false,
    ignoreBudget: entry.ignoreBudget ?? false,
    excludeRecursion: entry.excludeRecursion ?? false,
    preventRecursion: entry.preventRecursion ?? false,
    delayUntilRecursion: entry.delayUntilRecursion ?? 0,
    role: entry.role ?? 0,
    sticky: entry.sticky ?? null,
    cooldown: entry.cooldown ?? null,
    delay: entry.delay ?? null,
    scanDepth: entry.scanDepth ?? null,
    caseSensitive: entry.caseSensitive ?? null,
    matchWholeWords: entry.matchWholeWords ?? null,
    useGroupScoring: entry.useGroupScoring ?? null,
    automationId: entry.automationId ?? '',
    outletName: entry.outletName ?? '',
    vectorized: entry.vectorized ?? false,
  };
}

function formDataToEntry(data: EntryFormData, uid: number): WorldEntry {
  const parseKeywords = (s: string) =>
    s.split(',').map(k => k.trim()).filter(k => k.length > 0);

  return {
    uid,
    key: parseKeywords(data.key),
    keysecondary: parseKeywords(data.keysecondary),
    comment: data.comment,
    content: data.content,
    constant: data.constant,
    vectorized: data.vectorized,
    selective: data.selective,
    selectiveLogic: data.selectiveLogic,
    addMemo: data.addMemo,
    order: data.order,
    position: data.position,
    disable: data.disable,
    ignoreBudget: data.ignoreBudget,
    excludeRecursion: data.excludeRecursion,
    preventRecursion: data.preventRecursion,
    delayUntilRecursion: data.delayUntilRecursion,
    probability: data.probability,
    useProbability: data.useProbability,
    depth: data.depth,
    outletName: data.outletName,
    group: data.group,
    groupOverride: data.groupOverride,
    groupWeight: data.groupWeight,
    scanDepth: data.scanDepth,
    caseSensitive: data.caseSensitive,
    matchWholeWords: data.matchWholeWords,
    useGroupScoring: data.useGroupScoring,
    automationId: data.automationId,
    role: data.role,
    sticky: data.sticky,
    cooldown: data.cooldown,
    delay: data.delay,
  };
}

// ── 确认对话框 ──

function ConfirmDialog({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_40px_rgba(255,120,180,0.1)]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <h3 className="font-bold text-white text-lg">{title}</h3>
        </div>
        <p className="text-sm text-on-surface-variant mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant text-sm font-medium hover:bg-surface-container/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 输入对话框 ──

function InputDialog({
  open,
  title,
  placeholder,
  defaultValue,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  placeholder: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue || '');
  useEffect(() => { if (open) setValue(defaultValue || ''); }, [open, defaultValue]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container border border-outline-variant/30 rounded-2xl p-6 w-full max-w-sm shadow-[0_0_40px_rgba(255,120,180,0.1)]">
        <h3 className="font-bold text-white text-lg mb-4">{title}</h3>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-[#0D0F1A] border border-outline-variant/30 rounded-xl px-4 py-3 text-white text-sm placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/50 transition-colors mb-6"
          onKeyDown={e => { if (e.key === 'Enter' && value.trim()) onConfirm(value.trim()); }}
        />
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant text-sm font-medium hover:bg-surface-container/50 transition-colors">
            取消
          </button>
          <button
            onClick={() => { if (value.trim()) onConfirm(value.trim()); }}
            disabled={!value.trim()}
            className="flex-1 py-2.5 rounded-xl bg-accent-pink/20 border border-accent-pink/30 text-accent-pink text-sm font-medium hover:bg-accent-pink/30 transition-colors disabled:opacity-30"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 主组件 ──

export default function WorldBookManageScreen({ onNavigate }: WorldBookManageScreenProps) {
  const worldApi = useWorldApi();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 管理员权限检测
  const [isAdmin, setIsAdmin] = useState(true); // 先假设是管理员，API 失败时降级

  // 世界书列表
  const [worldList, setWorldList] = useState<WorldListItem[]>([]);
  const [selectedWorldFileId, setSelectedWorldFileId] = useState<string>('');

  // 已加载的世界书数据（缓存多个）
  const [worldDataCache, setWorldDataCache] = useState<Record<string, WorldBookData>>({});

  // 条目编辑状态
  const [editingEntryUid, setEditingEntryUid] = useState<number | null>(null);
  const [formData, setFormData] = useState<EntryFormData>(entryToFormData(createEmptyEntry(0)));
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 对话框
  const [confirmDeleteWorld, setConfirmDeleteWorld] = useState(false);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<number | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);

  // 展开的条目（预览用）
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());

  // 搜索关键词
  const [searchQuery, setSearchQuery] = useState('');

  // 脏标记
  const [isDirty, setIsDirty] = useState(false);

  // 加载世界书列表
  useEffect(() => {
    reloadWorldList();
  }, []);

  const reloadWorldList = useCallback(async () => {
    try {
      const list = await worldApi.adminListWorlds();
      setWorldList(list);
      setIsAdmin(true);
    } catch {
      // 非管理员回退到公开列表
      setIsAdmin(false);
      try {
        const list = await worldApi.listWorlds();
        setWorldList(list);
      } catch {
        showToast('无法加载世界书列表', 'error');
      }
    }
  }, [worldApi, showToast]);

  const currentWorldBook = worldDataCache[selectedWorldFileId] ?? null;
  const selectedWorldMeta = worldList.find(w => w.file_id === selectedWorldFileId);

  const loadWorldBook = useCallback(async (fileId: string) => {
    try {
      const data = await worldApi.adminGetWorld(fileId);
      setWorldDataCache(prev => ({ ...prev, [fileId]: data }));
      setIsDirty(false);
    } catch {
      // 非管理员用公开接口加载
      try {
        const detail = await worldApi.getWorld(fileId);
        // 公开接口只返回 promptText，不能编辑条目，转为 WorldBookData 格式
        const data: WorldBookData = { name: detail.name, entries: {} };
        setWorldDataCache(prev => ({ ...prev, [fileId]: data }));
        setIsDirty(false);
      } catch {
        showToast('加载世界书失败', 'error');
      }
    }
  }, [worldApi, showToast]);

  // 加载选中世界书的内容
  useEffect(() => {
    if (!selectedWorldFileId) return;
    if (worldDataCache[selectedWorldFileId]) return;
    loadWorldBook(selectedWorldFileId);
  }, [selectedWorldFileId, loadWorldBook, worldDataCache]);

  // 当前条目的排序列表
  const filteredEntries = (() => {
    const entries = currentWorldBook?.entries ?? {};
    const list = Object.values(entries);
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? list.filter(e =>
          e.comment.toLowerCase().includes(q) ||
          (e.key ?? []).some(k => k.toLowerCase().includes(q)) ||
          e.content.toLowerCase().includes(q)
        )
      : list;
    return filtered.sort((a, b) => a.order - b.order || a.uid - b.uid);
  })();

  // ── 世界书操作 ──

  const handleCreateWorld = async (name: string) => {
    const data: WorldBookData = { name, entries: {} };
    try {
      await worldApi.adminSaveWorld(name, data);
      showToast('世界书已创建', 'success');
      await reloadWorldList();
      setSelectedWorldFileId(name);
      setWorldDataCache(prev => ({ ...prev, [name]: data }));
    } catch (err: unknown) {
      showToast(`创建失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleDeleteWorld = async () => {
    const world = worldList.find(w => w.file_id === selectedWorldFileId);
    if (!world) return;
    try {
      await worldApi.adminDeleteWorld(world.file_id);
      showToast('世界书已删除', 'success');
      setSelectedWorldFileId('');
      setWorldDataCache(prev => {
        const next = { ...prev };
        delete next[world.file_id];
        return next;
      });
      await reloadWorldList();
    } catch (err: unknown) {
      showToast(`删除失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
    setConfirmDeleteWorld(false);
  };

  const handleImportWorld = async (file: File) => {
    try {
      const result = await worldApi.adminImportWorld(file);
      showToast(`导入成功: ${result.name}`, 'success');
      await reloadWorldList();
      setSelectedWorldFileId(result.name);
      setWorldDataCache(prev => {
        const next = { ...prev };
        delete next[result.name];
        return next;
      });
    } catch (err: unknown) {
      showToast(`导入失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  const handleSaveWorld = async () => {
    if (!selectedWorldFileId || !currentWorldBook) return;
    try {
      await worldApi.adminSaveWorld(selectedWorldFileId, currentWorldBook);
      showToast('已保存', 'success');
      setIsDirty(false);
    } catch (err: unknown) {
      showToast(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`, 'error');
    }
  };

  // ── 条目操作 ──

  const handleNewEntry = () => {
    const nextUid = Date.now();
    setFormData(entryToFormData(createEmptyEntry(nextUid)));
    setEditingEntryUid(nextUid);
    setShowAdvanced(false);
  };

  const handleEditEntry = (uid: number) => {
    const entry = currentWorldBook?.entries?.[String(uid)];
    if (!entry) return;
    setFormData(entryToFormData(entry));
    setEditingEntryUid(uid);
    setShowAdvanced(false);
  };

  const handleSaveEntry = () => {
    if (!currentWorldBook || editingEntryUid === null) return;
    const entry = formDataToEntry(formData, editingEntryUid);
    const newEntries = { ...currentWorldBook.entries, [String(editingEntryUid)]: entry };
    const newData = { ...currentWorldBook, entries: newEntries };
    setWorldDataCache(prev => ({ ...prev, [selectedWorldFileId]: newData }));
    setEditingEntryUid(null);
    setIsDirty(true);
  };

  const handleDeleteEntry = (uid: number) => {
    if (!currentWorldBook) return;
    const newEntries = { ...currentWorldBook.entries };
    delete newEntries[String(uid)];
    const newData = { ...currentWorldBook, entries: newEntries };
    setWorldDataCache(prev => ({ ...prev, [selectedWorldFileId]: newData }));
    setConfirmDeleteEntry(null);
    setIsDirty(true);
  };

  const handleDuplicateEntry = (uid: number) => {
    const entry = currentWorldBook?.entries?.[String(uid)];
    if (!entry) return;
    const newUid = Date.now();
    const newEntry = { ...entry, uid: newUid, comment: entry.comment + ' (副本)' };
    const newEntries = { ...currentWorldBook!.entries, [String(newUid)]: newEntry };
    setWorldDataCache(prev => ({ ...prev, [selectedWorldFileId]: { ...currentWorldBook!, entries: newEntries } }));
    setIsDirty(true);
    showToast('条目已复制', 'success');
  };

  const toggleEntryExpand = (uid: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleEntryDisable = (uid: number) => {
    if (!currentWorldBook) return;
    const entry = currentWorldBook.entries[String(uid)];
    if (!entry) return;
    const updated = { ...entry, disable: !entry.disable };
    const newEntries = { ...currentWorldBook.entries, [String(uid)]: updated };
    setWorldDataCache(prev => ({ ...prev, [selectedWorldFileId]: { ...currentWorldBook, entries: newEntries } }));
    setIsDirty(true);
  };

  // ── 渲染 ──

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#090A0F]">
      {/* Header */}
      <div className="shrink-0 px-4 pt-3 pb-2 flex items-center gap-3 border-b border-white/5">
        <button
          onClick={() => {
            if (isDirty) {
              if (window.confirm('有未保存的更改，确定离开吗？')) {
                onNavigate(ScreenId.SETTINGS);
              }
            } else {
              onNavigate(ScreenId.SETTINGS);
            }
          }}
          className="p-2 -ml-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface-variant" />
        </button>
        <BookOpen className="w-5 h-5 text-accent-purple" />
        <h1 className="text-base font-bold text-white">管理世界书</h1>
        {isDirty && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 ml-auto">
            未保存
          </span>
        )}
      </div>

      {/* 工具栏 */}
      <div className="shrink-0 px-4 py-2 flex gap-2 border-b border-white/5 overflow-x-auto">
        {!isAdmin && (
          <span className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-medium">
            ⚠️ 仅管理员可编辑
          </span>
        )}
        <button
          onClick={() => isAdmin ? setShowCreateDialog(true) : showToast('需要管理员权限', 'error')}
          className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
            isAdmin ? 'bg-accent-pink/20 border-accent-pink/30 text-accent-pink hover:bg-accent-pink/30' : 'bg-white/5 border-white/10 text-on-surface-variant/40 cursor-not-allowed'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          新建
        </button>
        <label className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
          isAdmin ? 'bg-accent-purple/20 border-accent-purple/30 text-accent-purple hover:bg-accent-purple/30 cursor-pointer' : 'bg-white/5 border-white/10 text-on-surface-variant/40 cursor-not-allowed'
        }`}>
          <Upload className="w-3.5 h-3.5" />
          导入
          {isAdmin && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImportWorld(file);
                e.target.value = '';
              }}
            />
          )}
        </label>
        {selectedWorldFileId && (
          <>
            <button
              onClick={handleSaveWorld}
              disabled={!isDirty || !isAdmin}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-colors flex items-center gap-1 disabled:opacity-30"
            >
              <Save className="w-3.5 h-3.5" />
              保存
            </button>
            <button
              onClick={isAdmin ? handleNewEntry : () => showToast('需要管理员权限', 'error')}
              className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
                isAdmin ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30' : 'bg-white/5 border-white/10 text-on-surface-variant/40 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              条目
            </button>
            <button
              onClick={() => isAdmin ? setConfirmDeleteWorld(true) : showToast('需要管理员权限', 'error')}
              className={`shrink-0 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1 ${
                isAdmin ? 'bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30' : 'bg-white/5 border-white/10 text-on-surface-variant/40 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </>
        )}
      </div>

      {/* 世界书选择器 */}
      <div className="shrink-0 px-4 py-2 border-b border-white/5">
        <select
          value={selectedWorldFileId}
          onChange={e => setSelectedWorldFileId(e.target.value)}
          className="w-full bg-[#0D0F1A] border border-outline-variant/30 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-accent-purple/50 transition-colors appearance-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 14px center',
            paddingRight: '36px',
          }}
        >
          <option value="" className="bg-[#0D0F1A]">选择要管理的世界书...</option>
          {worldList.map(w => (
            <option key={w.file_id} value={w.file_id} className="bg-[#0D0F1A]">
              {w.name} ({w.entriesCount} 条)
            </option>
          ))}
        </select>
      </div>

      {/* 主内容区 */}
      {!selectedWorldFileId ? (
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant gap-3 px-8">
          <FileJson className="w-12 h-12 text-on-surface-variant/30" />
          <p className="text-sm">选择一个世界书开始管理</p>
          <p className="text-xs text-on-surface-variant/40">或点击上方"新建"创建新的世界书</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* 搜索 + 信息栏 */}
          <div className="shrink-0 px-4 py-2 flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索条目（备注/关键词/内容）..."
                className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-purple/40 transition-colors"
              />
            </div>
            <span className="text-[10px] text-on-surface-variant/50 shrink-0">
              {filteredEntries.length} 条
            </span>
          </div>

          {/* 条目列表 */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant gap-2">
                <EyeOff className="w-8 h-8 text-on-surface-variant/20" />
                <p className="text-xs">
                  {searchQuery ? '没有匹配的条目' : '暂无条目，点击上方"条目"按钮创建'}
                </p>
              </div>
            ) : (
              filteredEntries.map(entry => (
                <EntryCard
                  key={entry.uid}
                  entry={entry}
                  expanded={expandedEntries.has(entry.uid)}
                  isAdmin={isAdmin}
                  onToggleExpand={() => toggleEntryExpand(entry.uid)}
                  onEdit={() => handleEditEntry(entry.uid)}
                  onDelete={() => setConfirmDeleteEntry(entry.uid)}
                  onDuplicate={() => handleDuplicateEntry(entry.uid)}
                  onToggleDisable={() => toggleEntryDisable(entry.uid)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* 条目编辑面板 */}
      <AnimatePresence>
        {editingEntryUid !== null && (
          <EntryEditorPanel
            formData={formData}
            onChange={setFormData}
            onSave={handleSaveEntry}
            onClose={() => setEditingEntryUid(null)}
            isNew={!currentWorldBook?.entries?.[String(editingEntryUid)]}
            showAdvanced={showAdvanced}
            onToggleAdvanced={() => setShowAdvanced(v => !v)}
          />
        )}
      </AnimatePresence>

      {/* 对话框 */}
      <ConfirmDialog
        open={confirmDeleteWorld}
        title="删除世界书"
        message={`确定要删除「${selectedWorldMeta?.name ?? selectedWorldFileId}」吗？此操作不可撤销，所有条目将永久丢失。`}
        onConfirm={handleDeleteWorld}
        onCancel={() => setConfirmDeleteWorld(false)}
      />
      <ConfirmDialog
        open={confirmDeleteEntry !== null}
        title="删除条目"
        message="确定要删除此条目吗？此操作不可撤销。"
        onConfirm={() => confirmDeleteEntry !== null && handleDeleteEntry(confirmDeleteEntry)}
        onCancel={() => setConfirmDeleteEntry(null)}
      />
      <InputDialog
        open={showCreateDialog}
        title="新建世界书"
        placeholder="世界书名称（英文/拼音，不含空格）"
        onConfirm={handleCreateWorld}
        onCancel={() => setShowCreateDialog(false)}
      />
      <InputDialog
        open={showRenameDialog}
        title="重命名世界书"
        placeholder="新的世界书名称"
        defaultValue={selectedWorldMeta?.name}
        onConfirm={() => {
          showToast('重命名功能需要在保存时使用新名称', 'info');
          setShowRenameDialog(false);
        }}
        onCancel={() => setShowRenameDialog(false)}
      />
    </div>
  );
}

// ── 条目卡片 ──

function EntryCard({
  entry,
  expanded,
  isAdmin,
  onToggleExpand,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleDisable,
}: {
  entry: WorldEntry;
  expanded: boolean;
  isAdmin: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleDisable: () => void;
}) {
  const keywords = [...(entry.key ?? []), ...(entry.keysecondary ?? [])].join('、');

  return (
    <div
      className={`rounded-xl border transition-colors ${
        entry.disable
          ? 'border-outline-variant/10 bg-surface-container/10 opacity-50'
          : 'border-outline-variant/20 bg-surface-container/20 hover:border-accent-purple/20'
      }`}
    >
      {/* 卡片头部 */}
      <button
        onClick={onToggleExpand}
        className="w-full px-3 py-2.5 flex items-center gap-2 text-left"
      >
        <div className="shrink-0">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-accent-purple" />
            : <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white truncate">
              {entry.comment || '（未命名条目）'}
            </span>
            {entry.constant && (
              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                恒定
              </span>
            )}
            {entry.disable && (
              <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                禁用
              </span>
            )}
          </div>
          {keywords && (
            <p className="text-[10px] text-on-surface-variant/60 truncate mt-0.5">
              关键词: {keywords}
            </p>
          )}
        </div>
        <span className="shrink-0 text-[10px] text-on-surface-variant/40">
          #{entry.uid.toString(36).slice(-4)}
        </span>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* 内容预览 */}
          <div className="bg-[#0D0F1A]/80 border border-outline-variant/10 rounded-lg p-2.5">
            <p className="text-[11px] text-on-surface-variant leading-relaxed whitespace-pre-wrap line-clamp-6">
              {entry.content || '（无内容）'}
            </p>
          </div>

          {/* 元信息 */}
          <div className="flex flex-wrap gap-1 text-[9px] text-on-surface-variant/50">
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              Order: {entry.order}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              Pos: {entry.position === 0 ? '前' : '后'}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-white/5">
              Depth: {entry.depth}
            </span>
            {entry.selective && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                Logic: {entry.selectiveLogic === 0 ? 'ANY' : 'ALL'}
              </span>
            )}
            {entry.group && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                {entry.group} (w{entry.groupWeight})
              </span>
            )}
            {entry.useProbability && (
              <span className="px-1.5 py-0.5 rounded bg-white/5">
                Prob: {entry.probability}%
              </span>
            )}
          </div>

          {/* 操作按钮 */}
          {isAdmin && (
            <div className="flex gap-1.5 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="flex-1 py-1.5 rounded-lg bg-accent-purple/20 border border-accent-purple/30 text-accent-purple text-[10px] font-medium hover:bg-accent-purple/30 transition-colors flex items-center justify-center gap-1"
              >
                <Edit3 className="w-3 h-3" /> 编辑
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                className="py-1.5 px-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-medium hover:bg-cyan-500/20 transition-colors"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleDisable(); }}
                className={`py-1.5 px-2.5 rounded-lg border text-[10px] font-medium transition-colors ${
                  entry.disable
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                }`}
              >
                {entry.disable ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="py-1.5 px-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 条目编辑面板 ──

function EntryEditorPanel({
  formData,
  onChange,
  onSave,
  onClose,
  isNew,
  showAdvanced,
  onToggleAdvanced,
}: {
  formData: EntryFormData;
  onChange: (data: EntryFormData) => void;
  onSave: () => void;
  onClose: () => void;
  isNew: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}) {
  const update = (patch: Partial<EntryFormData>) => onChange({ ...formData, ...patch });

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 26, stiffness: 200 }}
      className="absolute inset-x-0 bottom-0 top-16 z-40 bg-[#0A0C16] border-t border-accent-purple/20 rounded-t-3xl overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
    >
      {/* 面板头部 */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-accent-pink" />
          <h3 className="text-sm font-bold text-white">
            {isNew ? '新建条目' : '编辑条目'}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onSave}
            className="px-3 py-1.5 rounded-lg bg-accent-pink/20 border border-accent-pink/30 text-accent-pink text-xs font-medium hover:bg-accent-pink/30 transition-colors flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            保存
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4 text-on-surface-variant" />
          </button>
        </div>
      </div>

      {/* 表单 - 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 基础字段 */}
        <FormSection title="基本信息">
          <FormField label="备注（显示名称）">
            <input
              type="text"
              value={formData.comment}
              onChange={e => update({ comment: e.target.value })}
              placeholder="例如: 主角身世设定"
              className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors"
            />
          </FormField>

          <FormField label="内容（注入文本）">
            <textarea
              value={formData.content}
              onChange={e => update({ content: e.target.value })}
              placeholder="世界书激活时注入到对话上下文中的文本内容..."
              rows={4}
              className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors resize-none font-mono"
            />
          </FormField>

          <FormField label="触发关键词（英文逗号分隔）">
            <input
              type="text"
              value={formData.key}
              onChange={e => update({ key: e.target.value })}
              placeholder="关键词1, 关键词2, keyword3"
              className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors"
            />
          </FormField>

          <FormField label="副关键词（selective 模式下使用）">
            <input
              type="text"
              value={formData.keysecondary}
              onChange={e => update({ keysecondary: e.target.value })}
              placeholder="副关键词1, 副关键词2"
              className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors"
            />
          </FormField>
        </FormSection>

        {/* 行为设置 */}
        <FormSection title="行为设置">
          <div className="grid grid-cols-2 gap-2">
            <ToggleField label="恒定激活" value={formData.constant} onChange={v => update({ constant: v })} />
            <ToggleField label="禁用" value={formData.disable} onChange={v => update({ disable: v })} />
            <ToggleField label="使用副关键词" value={formData.selective} onChange={v => update({ selective: v })} />
            <ToggleField label="使用概率" value={formData.useProbability} onChange={v => update({ useProbability: v })} />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <NumberField label="排序 Order" value={formData.order} onChange={v => update({ order: v })} min={0} />
            <NumberField label="位置 Pos" value={formData.position} onChange={v => update({ position: v })} min={0} max={1} hint="0=前 1=后" />
            <NumberField label="深度 Depth" value={formData.depth} onChange={v => update({ depth: v })} min={0} max={99} />
          </div>

          {formData.selective && (
            <FormField label="副关键词逻辑">
              <select
                value={formData.selectiveLogic}
                onChange={e => update({ selectiveLogic: Number(e.target.value) })}
                className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-pink/40 transition-colors"
              >
                <option value={0}>ANY - 任一匹配即激活</option>
                <option value={1}>ALL - 全部匹配才激活</option>
              </select>
            </FormField>
          )}

          {formData.useProbability && (
            <NumberField label="触发概率 (%)" value={formData.probability} onChange={v => update({ probability: v })} min={0} max={100} />
          )}
        </FormSection>

        {/* 分组设置 */}
        <FormSection title="分组设置">
          <FormField label="分组名称">
            <input
              type="text"
              value={formData.group}
              onChange={e => update({ group: e.target.value })}
              placeholder="留空则不属于任何分组"
              className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors"
            />
          </FormField>
          {formData.group && (
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="组权重" value={formData.groupWeight} onChange={v => update({ groupWeight: v })} min={0} />
              <ToggleField label="组覆盖" value={formData.groupOverride} onChange={v => update({ groupOverride: v })} />
            </div>
          )}
        </FormSection>

        {/* 高级字段切换 */}
        <button
          onClick={onToggleAdvanced}
          className="w-full py-2 flex items-center justify-center gap-2 text-xs text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
        >
          {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          高级设置
        </button>

        {/* 高级字段 */}
        {showAdvanced && (
          <FormSection title="高级设置">
            <div className="grid grid-cols-2 gap-2">
              <ToggleField label="添加到备忘录" value={formData.addMemo} onChange={v => update({ addMemo: v })} />
              <ToggleField label="忽略 Token 预算" value={formData.ignoreBudget} onChange={v => update({ ignoreBudget: v })} />
              <ToggleField label="排除递归" value={formData.excludeRecursion} onChange={v => update({ excludeRecursion: v })} />
              <ToggleField label="防止递归" value={formData.preventRecursion} onChange={v => update({ preventRecursion: v })} />
              <ToggleField label="向量化" value={formData.vectorized} onChange={v => update({ vectorized: v })} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <NumberField label="延迟递归轮次" value={formData.delayUntilRecursion} onChange={v => update({ delayUntilRecursion: v })} min={0} />
              <NullableNumberField label="粘性 Sticky" value={formData.sticky} onChange={v => update({ sticky: v })} />
              <NullableNumberField label="冷却 Cooldown" value={formData.cooldown} onChange={v => update({ cooldown: v })} />
              <NullableNumberField label="延迟 Delay" value={formData.delay} onChange={v => update({ delay: v })} />
              <NullableNumberField label="扫描深度" value={formData.scanDepth} onChange={v => update({ scanDepth: v })} />
            </div>

            <h4 className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">匹配选项</h4>
            <div className="grid grid-cols-2 gap-2">
              <TriToggleField label="大小写敏感" value={formData.caseSensitive} onChange={v => update({ caseSensitive: v })} />
              <TriToggleField label="全词匹配" value={formData.matchWholeWords} onChange={v => update({ matchWholeWords: v })} />
              <TriToggleField label="组评分" value={formData.useGroupScoring} onChange={v => update({ useGroupScoring: v })} />
            </div>

            <h4 className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">角色</h4>
            <FormField label="适用角色">
              <select
                value={formData.role}
                onChange={e => update({ role: Number(e.target.value) })}
                className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-pink/40 transition-colors"
              >
                <option value={0}>所有消息</option>
                <option value={1}>仅用户消息</option>
                <option value={2}>仅模型消息</option>
              </select>
            </FormField>

            <FormField label="输出名称 (Outlet)">
              <input
                type="text"
                value={formData.outletName}
                onChange={e => update({ outletName: e.target.value })}
                placeholder="高阶用法，通常留空"
                className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors"
              />
            </FormField>

            <FormField label="自动化 ID">
              <input
                type="text"
                value={formData.automationId}
                onChange={e => update({ automationId: e.target.value })}
                placeholder="自动化标识符"
                className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/40 transition-colors"
              />
            </FormField>
          </FormSection>
        )}
      </div>
    </motion.div>
  );
}

// ── 表单辅助组件 ──

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-wider">
        {title}
      </h4>
      {children}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-on-surface-variant/60">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
        value
          ? 'bg-accent-pink/10 border-accent-pink/30 text-accent-pink'
          : 'bg-[#0D0F1A] border-outline-variant/20 text-on-surface-variant/60'
      }`}
    >
      <span>{label}</span>
      <span className={`w-8 h-4 rounded-full transition-colors flex items-center ${value ? 'bg-accent-pink/50' : 'bg-white/10'}`}>
        <span className={`w-3 h-3 rounded-full bg-white transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
    </button>
  );
}

function TriToggleField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean | null) => void }) {
  const states: { v: boolean | null; label: string }[] = [
    { v: null, label: '默认' },
    { v: true, label: '是' },
    { v: false, label: '否' },
  ];
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-on-surface-variant/60">{label}</span>
      <div className="flex gap-1">
        {states.map(s => (
          <button
            key={String(s.v)}
            onClick={() => onChange(s.v)}
            className={`flex-1 py-1.5 rounded-lg border text-[10px] font-medium transition-all ${
              value === s.v
                ? 'bg-accent-pink/10 border-accent-pink/30 text-accent-pink'
                : 'bg-[#0D0F1A] border-outline-variant/20 text-on-surface-variant/60'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-on-surface-variant/60 flex items-center gap-1">
        {label}
        {hint && <span className="text-on-surface-variant/30">({hint})</span>}
      </span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        min={min}
        max={max}
        className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-pink/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}

function NullableNumberField({
  label, value, onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-on-surface-variant/60">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full bg-[#0D0F1A] border border-outline-variant/20 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-accent-pink/40 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        placeholder="留空"
      />
    </label>
  );
}
