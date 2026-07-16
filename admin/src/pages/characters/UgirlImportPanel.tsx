import { useState } from 'react';
import { Upload, ChevronDown, ChevronRight, User, Folder, X, Check } from 'lucide-react';
import { useAdminImportUgirl } from '../../hooks/useAdminApi';
import type { UserViewModel, UgirlImportResult } from '../../types';

interface Props {
  users: UserViewModel[];
}

export default function UgirlImportPanel({ users }: Props) {
  const importUgirl = useAdminImportUgirl();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState(users[0]?.handle || 'default-user');
  const [filePath, setFilePath] = useState('');
  const [result, setResult] = useState<UgirlImportResult | null>(null);

  return (
    <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-white font-mono hover:bg-surface-container/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-accent-pink" />
          <span className="font-semibold">批量导入 ugirl 角色</span>
          <span className="text-[10px] text-on-surface-variant/50 font-normal">服务器 JSON 路径</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-on-surface-variant/50" /> : <ChevronRight className="w-4 h-4 text-on-surface-variant/50" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">导入到用户</label>
            <div className="flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-2">
              <User className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
              <select
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="bg-transparent text-xs text-white outline-none cursor-pointer w-full"
              >
                {users.map((u) => (
                  <option key={u.handle} value={u.handle}>{u.handle}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">JSON 文件路径</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-2">
                <Folder className="w-3.5 h-3.5 text-on-surface-variant/60 flex-shrink-0" />
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => {
                    setFilePath(e.target.value);
                    setResult(null);
                  }}
                  placeholder="/path/to/ugirl_processed.json"
                  className="bg-transparent text-xs text-white outline-none w-full placeholder:text-on-surface-variant/30"
                />
              </div>
              <button
                onClick={async () => {
                  const trimmed = filePath.trim();
                  if (!trimmed) return;
                  setResult(null);
                  try {
                    const r = await importUgirl.mutateAsync({ filePath: trimmed, handle });
                    setResult(r as UgirlImportResult);
                  } catch {
                    /* handled */
                  }
                }}
                disabled={importUgirl.isPending || !filePath.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
              >
                <Upload className="w-3.5 h-3.5" />
                {importUgirl.isPending ? '导入中...' : '开始导入'}
              </button>
            </div>
          </div>

          {importUgirl.isError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
              导入失败：{(importUgirl.error as Error).message}
            </div>
          )}

          {result && (
            <div className="bg-surface-elevated/40 border border-outline-variant/20 rounded-xl px-4 py-3 text-xs flex gap-4">
              <span className="text-on-surface-variant">总计 <b className="text-white">{result.total}</b></span>
              <span className="text-green-400">成功 {result.success}</span>
              <span className={result.failed > 0 ? 'text-red-400' : 'text-on-surface-variant'}>失败 {result.failed}</span>
            </div>
          )}

          {result && result.failed > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {result.results.filter((r) => r.status === 'failed').map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <X className="w-3 h-3 text-red-400 mt-0.5" />
                  <span className="text-white">{r.name}</span>
                  <span className="text-red-400/70">{r.error}</span>
                </div>
              ))}
            </div>
          )}

          {result && result.success > 0 && (
            <div className="text-[10px] text-green-400 flex items-center gap-1">
              <Check className="w-3 h-3" /> 已成功导入 {result.success} 个角色
            </div>
          )}
        </div>
      )}
    </div>
  );
}
