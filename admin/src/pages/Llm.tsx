import { useState } from 'react';
import { useAdminLlms, useTestLlm } from '../hooks/useAdminApi';
import type { AdminLlmProvider, AdminLlmTestResult } from '../types';
import { Cpu, Zap, CheckCircle2, XCircle, Loader, Radio } from 'lucide-react';

export default function Llm() {
  const { data, isLoading, error } = useAdminLlms();
  const testLlm = useTestLlm();
  const [results, setResults] = useState<Record<string, AdminLlmTestResult>>({});
  const [testingId, setTestingId] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testLlm.mutateAsync(id);
      setResults((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [id]: {
          ok: false,
          latencyMs: 0,
          error: err instanceof Error ? err.message : '测试失败',
        },
      }));
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-wider">模型配置</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          只读查看 Provider 配置，并测试连通性（不修改环境变量）
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-surface-container/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !data?.providers?.length ? (
        <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl px-5 py-12 text-center text-xs text-on-surface-variant">
          未配置任何 LLM。请在 backend/.env 中设置 SIMPLE_TAVERN_LLM_0_* 变量。
        </div>
      ) : (
        <div className="space-y-3">
          {data.providers.map((p) => (
            <ProviderCard
              key={p.id}
              provider={p}
              result={results[p.id]}
              testing={testingId === p.id}
              onTest={() => handleTest(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderCard({
  provider,
  result,
  testing,
  onTest,
}: {
  provider: AdminLlmProvider;
  result?: AdminLlmTestResult;
  testing: boolean;
  onTest: () => void;
}) {
  return (
    <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-accent-pink/10 border border-accent-pink/30 text-accent-pink flex-shrink-0">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white font-mono">{provider.name}</h3>
              <span className="text-[10px] text-on-surface-variant font-mono">{provider.id}</span>
              {provider.active && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-500/10 border border-green-500/30 text-green-400">
                  <Radio className="w-3 h-3" /> Active
                </span>
              )}
              {provider.isLocal && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
                  Local
                </span>
              )}
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1 font-mono truncate" title={provider.baseUrl}>
              {provider.model} · {provider.baseUrl}
            </p>
            <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
              API Key: {provider.configured ? `****${provider.apiKeyLast4 || ''}` : '未配置'}
            </p>
          </div>
        </div>

        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-1.5 px-3 py-2 bg-surface-elevated border border-outline-variant/30 text-xs text-white rounded-xl hover:border-accent-pink/40 disabled:opacity-50 cursor-pointer transition-colors flex-shrink-0"
        >
          {testing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-accent-pink" />}
          {testing ? '测试中' : '测连通'}
        </button>
      </div>

      {result && (
        <div
          className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${
            result.ok
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {result.ok ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />}
          <div>
            {result.ok ? (
              <span>连通成功 · {result.latencyMs}ms{result.status ? ` · HTTP ${result.status}` : ''}</span>
            ) : (
              <span>
                失败 · {result.latencyMs}ms
                {result.error ? ` · ${result.error}` : ''}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
