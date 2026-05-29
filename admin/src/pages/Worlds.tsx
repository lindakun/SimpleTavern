import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  useAllWorlds,
  useAdminSaveWorld,
  useAdminDeleteWorld,
  useAdminImportWorld,
} from '../hooks/useAdminApi';
import { BookOpen, Plus, Trash2, X, Check, Search, Eye, Upload } from 'lucide-react';
import type { AdminWorldItem, WorldInfoEntry, WorldInfoData } from '../types';

export default function Worlds() {
  const { data: worlds = [], isLoading, error } = useAllWorlds();
  const deleteWorld = useAdminDeleteWorld();
  const importWorld = useAdminImportWorld();

  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [editingWorld, setEditingWorld] = useState<AdminWorldItem | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return worlds;
    const q = search.toLowerCase();
    return worlds.filter((w) =>
      w.name.toLowerCase().includes(q) || w.file_id.toLowerCase().includes(q)
    );
  }, [worlds, search]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteWorld.mutateAsync(confirmDelete);
      setConfirmDelete(null);
    } catch { /* handled by hook */ }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-wider">世界书管理</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          {isLoading ? '加载中...' : `共 ${worlds.length} 个世界书`}
        </p>
      </div>

      {/* 导入按钮 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowImportModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          导入世界书
        </button>
      </div>

      {/* 导入弹窗 */}
      {showImportModal && (
        <ImportWorldModal
          onClose={() => setShowImportModal(false)}
          onImport={async (file: File) => {
            await importWorld.mutateAsync(file);
            setShowImportModal(false);
          }}
          isImporting={importWorld.isPending}
          importError={importWorld.error ? (importWorld.error as Error).message : null}
        />
      )}

      {/* 搜索 */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索世界书名称..."
          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {/* 世界书列表 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-container/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant font-mono">
                  <th className="text-left px-5 py-3 font-semibold">名称</th>
                  <th className="text-left px-5 py-3 font-semibold">文件名</th>
                  <th className="text-center px-5 py-3 font-semibold">条目数</th>
                  <th className="text-right px-5 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-on-surface-variant">
                      没有找到世界书，点击右上角"导入世界书"按钮导入 .json 文件
                    </td>
                  </tr>
                ) : (
                  filtered.map((world) => (
                    <tr key={world.file_id} className="border-b border-outline-variant/10 hover:bg-surface-container/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-accent-pink/15 flex items-center justify-center flex-shrink-0">
                            <BookOpen className="w-3.5 h-3.5 text-accent-pink" />
                          </div>
                          <span className="text-white font-medium">{world.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-on-surface-variant/60 font-mono text-[10px]">{world.file_id}.json</span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className="text-on-surface-variant font-mono text-[11px]">{world.entriesCount}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingWorld(world)}
                            title="编辑条目"
                            className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-accent-cyan hover:bg-accent-cyan/10 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {confirmDelete === world.file_id ? (
                            <>
                              <button
                                onClick={handleDelete}
                                disabled={deleteWorld.isPending}
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
                              onClick={() => setConfirmDelete(world.file_id)}
                              title="删除世界书"
                              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-red-400 hover:bg-red-500/10 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 条目编辑弹窗 */}
      {editingWorld && (
        <WorldEditor
          world={editingWorld}
          onClose={() => setEditingWorld(null)}
        />
      )}
    </div>
  );
}

/**
 * 导入世界书弹窗（上传 .json 文件）
 */
function ImportWorldModal({
  onClose,
  onImport,
  isImporting,
  importError,
}: {
  onClose: () => void;
  onImport: (file: File) => Promise<void>;
  isImporting: boolean;
  importError: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | undefined) => {
    setLocalError('');
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setLocalError('请选择 .json 格式的文件');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setLocalError('文件大小不能超过 10MB');
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setLocalError('请先选择文件');
      return;
    }
    try {
      await onImport(selectedFile);
    } catch {
      // error handled by parent
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden">
        {/* 弹头 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-2.5">
            <Upload className="w-4 h-4 text-accent-pink" />
            <h2 className="text-sm font-bold text-white font-mono">导入世界书</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* 拖拽上传区 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-accent-pink bg-accent-pink/5'
                : 'border-outline-variant/30 hover:border-accent-pink/50 hover:bg-surface-container/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
            <Upload className={`w-8 h-8 mx-auto mb-3 ${dragOver ? 'text-accent-pink' : 'text-on-surface-variant/40'}`} />
            {selectedFile ? (
              <div className="space-y-1">
                <p className="text-xs text-white font-medium">{selectedFile.name}</p>
                <p className="text-[10px] text-on-surface-variant/50">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-xs text-on-surface-variant">
                  拖拽 .json 文件到此处，或 <span className="text-accent-pink">点击选择文件</span>
                </p>
                <p className="text-[10px] text-on-surface-variant/40">
                  支持 SillyTavern 世界书 .json 格式，最大 10MB
                </p>
              </div>
            )}
          </div>

          {/* 错误提示 */}
          {(localError || importError) && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-400">
              {localError || importError}
            </div>
          )}

          {/* 底部按钮 */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isImporting || !selectedFile}
              className="flex-1 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isImporting ? '导入中...' : '导入'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 补充 useRef import
import { useRef } from 'react';

/**
 * 世界书条目编辑弹窗
 */
function WorldEditor({
  world,
  onClose,
}: {
  world: AdminWorldItem;
  onClose: () => void;
}) {
  const [worldData, setWorldData] = useState<WorldInfoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const saveWorld = useAdminSaveWorld();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/worlds/admin-get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: world.file_id }),
    })
      .then((r) => r.json())
      .then((data) => {
        setWorldData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('加载失败');
        setLoading(false);
      });
  }, [world.file_id]);

  const entriesList = useMemo(() => {
    if (!worldData?.entries) return [];
    return Object.entries(worldData.entries)
      .map(([uid, entry]) => ({ uid, entry }))
      .sort((a, b) => (a.entry.order ?? 100) - (b.entry.order ?? 100));
  }, [worldData]);

  const updateEntry = useCallback((uid: string, field: string, value: unknown) => {
    setWorldData((prev) => {
      if (!prev) return prev;
      const entries = { ...prev.entries };
      entries[uid] = { ...entries[uid], [field]: value } as WorldInfoEntry;
      return { ...prev, entries };
    });
  }, []);

  const deleteEntry = useCallback((uid: string) => {
    setWorldData((prev) => {
      if (!prev) return prev;
      const entries = { ...prev.entries };
      delete entries[uid];
      return { ...prev, entries };
    });
  }, []);

  const addEntry = useCallback(() => {
    setWorldData((prev) => {
      if (!prev) return prev;
      const entries = { ...prev.entries };
      const uids = Object.keys(entries).map(Number).filter((n) => !isNaN(n));
      const nextUid = uids.length > 0 ? Math.max(...uids) + 1 : 0;
      const uidStr = String(nextUid);
      entries[uidStr] = {
        uid: nextUid, key: [], keysecondary: [], content: '', comment: '',
        constant: false, vectorized: false, selective: true, selectiveLogic: 0,
        addMemo: false, order: 100, position: 0, disable: false, ignoreBudget: false,
        excludeRecursion: false, preventRecursion: false, delayUntilRecursion: 0,
        probability: 100, useProbability: true, depth: 4, outletName: '', group: '',
        groupOverride: false, groupWeight: 100, scanDepth: null, caseSensitive: null,
        matchWholeWords: null, useGroupScoring: null, automationId: '', role: 0,
        sticky: null, cooldown: null, delay: null,
      };
      return { ...prev, entries };
    });
  }, []);

  const handleSave = async () => {
    if (!worldData) return;
    setSaving(true);
    try {
      await saveWorld.mutateAsync({ name: world.file_id, data: worldData });
      onClose();
    } catch {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl max-h-[85vh] bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-accent-pink" />
            <h2 className="text-sm font-bold text-white font-mono">{world.name}</h2>
            <span className="text-[10px] text-on-surface-variant/40 font-mono">
              {worldData ? `${Object.keys(worldData.entries).length} 个条目` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addEntry} className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan text-[10px] font-semibold rounded-lg hover:bg-accent-cyan/20 transition-colors cursor-pointer">
              <Plus className="w-3 h-3" />
              新增条目
            </button>
            <button onClick={onClose} className="text-on-surface-variant hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-24 bg-surface-container/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">{error}</div>
          ) : entriesList.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant text-xs">暂无条目，点击"新增条目"添加</div>
          ) : (
            <div className="space-y-3">
              {entriesList.map(({ uid, entry }) => (
                <EntryCard key={uid} entry={entry} onUpdate={(field, value) => updateEntry(uid, field, value)} onDelete={() => deleteEntry(uid)} />
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-outline-variant/20 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer">取消</button>
          <button onClick={handleSave} disabled={saving || !worldData} className="flex-1 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryCard({ entry, onUpdate, onDelete }: { entry: WorldInfoEntry; onUpdate: (field: string, value: unknown) => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-surface-container/50 border ${entry.disable ? 'border-outline-variant/10 opacity-60' : 'border-outline-variant/20'} rounded-xl overflow-hidden transition-all`}>
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer text-left">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${entry.disable ? 'bg-on-surface-variant/30' : 'bg-accent-green'}`} />
            <span className="text-xs text-white font-medium truncate">{entry.key?.join(', ') || '(无关键词)'}</span>
          </button>
          <span className="text-[10px] text-on-surface-variant/40 font-mono flex-shrink-0">#{entry.uid}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] text-on-surface-variant/40 font-mono">order: {entry.order ?? 100}</span>
          <button onClick={onDelete} className="p-1 rounded text-on-surface-variant/30 hover:text-red-400 cursor-pointer" title="删除条目">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-outline-variant/10 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="关键词">
              <input type="text" value={(entry.key || []).join(', ')} onChange={(e) => onUpdate('key', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="逗号分隔" className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors" />
            </FieldGroup>
            <FieldGroup label="副关键词">
              <input type="text" value={(entry.keysecondary || []).join(', ')} onChange={(e) => onUpdate('keysecondary', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} placeholder="逗号分隔" className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors" />
            </FieldGroup>
          </div>
          <FieldGroup label="内容">
            <textarea value={entry.content || ''} onChange={(e) => onUpdate('content', e.target.value)} rows={3} className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[11px] text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors resize-y font-mono" />
          </FieldGroup>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="备注">
              <input type="text" value={entry.comment || ''} onChange={(e) => onUpdate('comment', e.target.value)} className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-accent-pink transition-colors" />
            </FieldGroup>
            <FieldGroup label="排序 (order)">
              <input type="number" value={entry.order ?? 100} onChange={(e) => onUpdate('order', parseInt(e.target.value) || 100)} className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-accent-pink transition-colors" />
            </FieldGroup>
          </div>
          <div className="flex items-center gap-4 pt-1 flex-wrap">
            <ToggleField label="禁用" checked={!!entry.disable} onChange={(v) => onUpdate('disable', v)} />
            <ToggleField label="始终激活" checked={!!entry.constant} onChange={(v) => onUpdate('constant', v)} />
            <ToggleField label="使用副关键词" checked={entry.selective !== false} onChange={(v) => onUpdate('selective', v)} />
            <ToggleField label="概率触发" checked={entry.useProbability !== false} onChange={(v) => onUpdate('useProbability', v)} />
          </div>
          {(entry.useProbability !== false) && (
            <FieldGroup label="触发概率 (%)">
              <input type="number" min={0} max={100} value={entry.probability ?? 100} onChange={(e) => onUpdate('probability', parseInt(e.target.value) || 0)} className="w-24 bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-1.5 text-[11px] text-white outline-none focus:border-accent-pink transition-colors" />
            </FieldGroup>
          )}
        </div>
      )}
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-on-surface-variant ml-1">{label}</label>
      {children}
    </div>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="w-3.5 h-3.5 accent-accent-pink cursor-pointer" />
      <span className="text-[11px] text-on-surface-variant">{label}</span>
    </label>
  );
}
