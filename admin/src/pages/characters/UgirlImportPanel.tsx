import { useEffect, useRef, useState } from 'react';
import {
  Upload,
  ChevronDown,
  ChevronRight,
  User,
  Folder,
  X,
  Check,
  Zap,
  RefreshCw,
  FileJson,
} from 'lucide-react';
import {
  useAdminImportUgirl,
  useAdminImportUgirlUpload,
  useAdminListUgirlPackages,
} from '../../hooks/useAdminApi';
import type { UserViewModel, UgirlImportResult } from '../../types';

interface Props {
  users: UserViewModel[];
}

export default function UgirlImportPanel({ users }: Props) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState(users[0]?.handle || 'default-user');
  const [filePath, setFilePath] = useState('');
  const [result, setResult] = useState<UgirlImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const packagesQuery = useAdminListUgirlPackages(open);
  const importUgirl = useAdminImportUgirl();
  const importUpload = useAdminImportUgirlUpload();

  const busy = importUgirl.isPending || importUpload.isPending;
  const error =
    (importUgirl.isError && (importUgirl.error as Error).message) ||
    (importUpload.isError && (importUpload.error as Error).message) ||
    null;

  // 打开面板时若有默认包则填入
  useEffect(() => {
    if (!packagesQuery.data) return;
    if (filePath) return;
    const def =
      packagesQuery.data.packages.find((p) => p.isDefault)?.path ||
      packagesQuery.data.defaultPath ||
      '';
    if (def) setFilePath(def);
  }, [packagesQuery.data, filePath]);

  const runPathImport = async (pathOverride?: string) => {
    setResult(null);
    try {
      const r = await importUgirl.mutateAsync({
        filePath: pathOverride ?? (filePath.trim() || undefined),
        handle,
      });
      setResult(r as UgirlImportResult);
      packagesQuery.refetch();
    } catch {
      /* mutation error state */
    }
  };

  const onPickFile = async (file: File | null) => {
    if (!file) return;
    setResult(null);
    try {
      const r = await importUpload.mutateAsync({ file, handle });
      setResult(r as UgirlImportResult);
    } catch {
      /* handled */
    }
  };

  const pkgs = packagesQuery.data?.packages || [];
  const mountExists = packagesQuery.data?.exists;

  return (
    <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm text-white font-mono hover:bg-surface-container/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <Upload className="w-4 h-4 text-accent-pink" />
          <span className="font-semibold">批量导入 ugirl 角色</span>
          <span className="text-[10px] text-on-surface-variant/50 font-normal">
            一键 / 上传 / 路径
          </span>
        </div>
        {open ? (
          <ChevronDown className="w-4 h-4 text-on-surface-variant/50" />
        ) : (
          <ChevronRight className="w-4 h-4 text-on-surface-variant/50" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          <p className="text-[11px] text-on-surface-variant/70 leading-relaxed">
            <b className="text-white/80">推荐</b>：服务器已挂载 ugirl 仓库时，点「一键导入默认包」。
            无挂载时可直接上传 <code className="text-accent-pink/90">characters.json</code>
            （头像走远端 URL）或完整 <code className="text-accent-pink/90">st-package.zip</code>。
            按 <code className="text-accent-pink/90">ugirl_id</code> 幂等更新。
          </p>

          {/* 目标用户 */}
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
                  <option key={u.handle} value={u.handle}>
                    {u.handle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 方式 A：一键 */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold text-on-surface-variant ml-1">方式 A · 服务器挂载一键导入</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => runPathImport(undefined)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                {importUgirl.isPending ? '导入中…' : '一键导入默认包'}
              </button>
              <button
                type="button"
                disabled={packagesQuery.isFetching}
                onClick={() => packagesQuery.refetch()}
                className="flex items-center gap-1.5 px-3 py-2 text-[11px] text-on-surface-variant border border-outline-variant/30 rounded-xl hover:bg-surface-container/50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${packagesQuery.isFetching ? 'animate-spin' : ''}`} />
                刷新包列表
              </button>
            </div>
            {packagesQuery.isLoading && (
              <p className="text-[10px] text-on-surface-variant/50">正在扫描 /ugirl_data …</p>
            )}
            {mountExists === false && (
              <p className="text-[10px] text-amber-300/90">
                未检测到 /ugirl_data。请配置 Docker 卷 UGIRL_DATA_HOST_PATH，或改用下方上传。
              </p>
            )}
            {pkgs.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-on-surface-variant ml-1">或选择已扫描到的包</label>
                <select
                  value={filePath}
                  onChange={(e) => {
                    setFilePath(e.target.value);
                    setResult(null);
                  }}
                  className="w-full bg-surface-container/50 border border-outline-variant/20 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer"
                >
                  {pkgs.map((p) => (
                    <option key={p.path} value={p.path}>
                      {p.label}
                      {p.hasAvatarsDir ? '' : ' · 无本地头像目录'}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !filePath}
                  onClick={() => runPathImport(filePath)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-elevated text-white text-xs font-semibold rounded-xl border border-outline-variant/30 hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5" />
                  导入所选包
                </button>
              </div>
            )}
          </div>

          {/* 方式 B：上传 */}
          <div className="space-y-2 border-t border-outline-variant/15 pt-4">
            <div className="text-[11px] font-semibold text-on-surface-variant ml-1">
              方式 B · 浏览器直接上传（无需先拷到服务器）
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.zip,application/json,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                e.target.value = '';
                void onPickFile(f);
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-sky-600/90 hover:bg-sky-500 text-white text-xs font-bold rounded-xl disabled:opacity-50 cursor-pointer transition-colors"
            >
              <FileJson className="w-3.5 h-3.5" />
              {importUpload.isPending ? '上传并导入中…' : '上传 characters.json 或 st-package.zip'}
            </button>
            <p className="text-[10px] text-on-surface-variant/55 leading-relaxed">
              · 只传 JSON：会用包内 <code className="text-white/50">avatar_url_remote</code> 在线拉头像
              <br />
              · 传 zip：需含 <code className="text-white/50">characters.json</code> +{' '}
              <code className="text-white/50">avatars/</code>（服务器需有 unzip）
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
              导入失败：{error}
            </div>
          )}

          {result && (
            <div className="bg-surface-elevated/40 border border-outline-variant/20 rounded-xl px-4 py-3 text-xs flex flex-wrap gap-4">
              <span className="text-on-surface-variant">
                总计 <b className="text-white">{result.total}</b>
              </span>
              <span className="text-green-400">成功 {result.success}</span>
              {typeof result.created === 'number' && (
                <span className="text-sky-400">新建 {result.created}</span>
              )}
              {typeof result.updated === 'number' && (
                <span className="text-amber-300">更新 {result.updated}</span>
              )}
              {typeof result.skipped === 'number' && result.skipped > 0 && (
                <span className="text-on-surface-variant">跳过 {result.skipped}</span>
              )}
              <span className={result.failed > 0 ? 'text-red-400' : 'text-on-surface-variant'}>
                失败 {result.failed}
              </span>
            </div>
          )}

          {result && result.failed > 0 && (
            <div className="max-h-32 overflow-y-auto space-y-1">
              {result.results
                .filter((r) => r.status === 'failed')
                .map((r, i) => (
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
              <Check className="w-3 h-3" /> 已处理 {result.success} 个角色
              {typeof result.updated === 'number' && result.updated > 0
                ? `（含更新 ${result.updated}）`
                : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
