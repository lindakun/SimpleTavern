import { useEffect, useState } from 'react';
import { X, Loader, Star, Trash2, Lock, Unlock, Pencil } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { useAdminDeleteReview } from '../../hooks/useAdminApi';
import type { AdminCharacterDetailResponse, AdminCharacterItem, AdminReviewItem } from '../../types';
import { getFileName, sourceLabel } from './utils';

interface Props {
  char: AdminCharacterItem;
  onClose: () => void;
  onEdit: () => void;
  onTogglePrivacy?: () => void;
  privacyPending?: boolean;
}

export default function CharacterDetailDrawer({
  char,
  onClose,
  onEdit,
  onTogglePrivacy,
  privacyPending,
}: Props) {
  const [detail, setDetail] = useState<AdminCharacterDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const deleteReview = useAdminDeleteReview();
  const [reviews, setReviews] = useState<AdminReviewItem[]>([]);
  const fileName = getFileName(char);

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
  const privacy = c.privacyType || (c._source === 'seed' ? 'public' : null);

  const handleDeleteReview = async (r: AdminReviewItem) => {
    try {
      await deleteReview.mutateAsync({
        store: r.store,
        characterKey: r.characterKey,
        reviewId: r.id,
      });
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-surface border-l border-outline-variant/20 h-full overflow-y-auto">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur border-b border-outline-variant/20 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white font-mono">{c.name || '角色详情'}</h2>
            <p className="text-[10px] text-on-surface-variant font-mono mt-0.5">
              {c._owner} · {sourceLabel(c._source)}
              {readonly ? ' · 只读' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!readonly && c._source === 'published' && onTogglePrivacy && (
              <button
                onClick={onTogglePrivacy}
                disabled={privacyPending}
                className="px-2.5 py-1.5 text-[11px] text-yellow-400 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/10 cursor-pointer flex items-center gap-1"
              >
                {privacy === 'public' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                {privacy === 'public' ? '下架' : '上架'}
              </button>
            )}
            {!readonly && (
              <button
                onClick={onEdit}
                className="px-2.5 py-1.5 text-[11px] text-accent-pink border border-accent-pink/30 rounded-lg hover:bg-accent-pink/10 cursor-pointer flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
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

          <Section title="概要">
            <Row label="隐私" value={c._source === 'file' ? '文件（不可上架）' : String(privacy || '-')} />
            <Row label="ID" value={String(c.id || '-')} />
            <Row label="文件" value={fileName || '-'} />
            <Row label="标签" value={Array.isArray(c.tags) ? c.tags.join(', ') || '-' : '-'} />
          </Section>

          <Section title="人设">
            <ExpandableText label="描述" text={c.description} />
            <ExpandableText label="性格" text={c.personality} />
            <ExpandableText label="场景" text={c.scenario} />
          </Section>

          <Section title="对话设定">
            <ExpandableText label="开场白" text={c.first_mes} />
          </Section>

          <Section title="系统">
            <ExpandableText label="system_prompt" text={c.system_prompt} />
          </Section>

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
                  <div key={r.id} className="bg-surface-container/40 border border-outline-variant/15 rounded-xl p-3 space-y-1.5">
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold text-on-surface-variant font-mono">{title}</h3>
      <div className="bg-surface-container/40 border border-outline-variant/15 rounded-xl p-4 space-y-2 text-xs">
        {children}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-on-surface-variant w-14 flex-shrink-0">{label}</span>
      <span className="text-white break-all">{value}</span>
    </div>
  );
}

function ExpandableText({ label, text }: { label: string; text?: string }) {
  const [open, setOpen] = useState(false);
  const raw = text || '';
  if (!raw) {
    return (
      <div>
        <p className="text-[10px] text-on-surface-variant mb-0.5">{label}</p>
        <p className="text-white/40">（无）</p>
      </div>
    );
  }
  const long = raw.length > 400;
  const shown = !long || open ? raw : `${raw.slice(0, 400)}…`;
  return (
    <div>
      <p className="text-[10px] text-on-surface-variant mb-0.5">{label}</p>
      <p className="text-white/80 whitespace-pre-wrap leading-relaxed">{shown}</p>
      {long && (
        <button
          onClick={() => setOpen(!open)}
          className="text-[10px] text-accent-pink mt-1 cursor-pointer hover:underline"
        >
          {open ? '收起' : '展开全部'}
        </button>
      )}
    </div>
  );
}
