import { Trash2, Loader } from 'lucide-react';

interface Props {
  selectedCount: number;
  batchDeleting: boolean;
  progress: { current: number; total: number };
  onClear: () => void;
  onConfirmDelete: () => void;
}

export default function BatchActionBar({
  selectedCount,
  batchDeleting,
  progress,
  onClear,
  onConfirmDelete,
}: Props) {
  if (batchDeleting) {
    return (
      <div className="flex items-center gap-3 bg-accent-pink/5 border border-accent-pink/20 rounded-xl px-4 py-3">
        <Loader className="w-4 h-4 text-accent-pink animate-spin" />
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-white">正在删除...</span>
            <span className="text-[10px] text-on-surface-variant font-mono">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-pink to-accent-purple rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between bg-accent-pink/10 border border-accent-pink/25 rounded-xl px-5 py-2.5">
      <span className="text-xs text-white">
        已选择 <span className="text-accent-pink font-bold">{selectedCount}</span> 个角色
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-xs text-on-surface-variant hover:text-white rounded-lg transition-colors cursor-pointer"
        >
          取消选择
        </button>
        <button
          onClick={onConfirmDelete}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold rounded-xl hover:bg-red-500/30 active:scale-95 transition-all cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          删除所选
        </button>
      </div>
    </div>
  );
}
