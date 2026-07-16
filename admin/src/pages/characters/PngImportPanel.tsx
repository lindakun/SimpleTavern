import { useState } from 'react';
import { FileUp, ChevronDown, ChevronRight, User, Check } from 'lucide-react';
import { useAdminImportPng } from '../../hooks/useAdminApi';
import type { UserViewModel } from '../../types';

interface Props {
  users: UserViewModel[];
}

export default function PngImportPanel({ users }: Props) {
  const importPng = useAdminImportPng();
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState(users[0]?.handle || 'default-user');
  const [file, setFile] = useState<File | null>(null);
  const [successPath, setSuccessPath] = useState<string | null>(null);

  return (
    <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-white font-mono hover:bg-surface-container/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <FileUp className="w-4 h-4 text-accent-purple" />
          <span className="font-semibold">上传 PNG/JSON 角色卡</span>
          <span className="text-[10px] text-on-surface-variant/50 font-normal">导入到指定用户</span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-on-surface-variant/50" /> : <ChevronRight className="w-4 h-4 text-on-surface-variant/50" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">目标用户</label>
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
            <label className="text-[11px] font-semibold text-on-surface-variant ml-1">角色卡文件</label>
            <input
              type="file"
              accept=".png,.json,image/png,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setSuccessPath(null);
              }}
              className="block w-full text-xs text-on-surface-variant file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-accent-pink/15 file:text-accent-pink file:text-xs file:font-semibold file:cursor-pointer"
            />
          </div>

          <button
            onClick={async () => {
              if (!file) return;
              setSuccessPath(null);
              try {
                const r = await importPng.mutateAsync({ file, handle });
                setSuccessPath(r.path);
                setFile(null);
              } catch {
                /* handled */
              }
            }}
            disabled={!file || importPng.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            <FileUp className="w-3.5 h-3.5" />
            {importPng.isPending ? '上传中...' : '上传并导入'}
          </button>

          {importPng.isError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
              导入失败：{(importPng.error as Error).message}
            </div>
          )}

          {successPath && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-xs text-green-400 flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              已导入到 {handle}：{successPath}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
