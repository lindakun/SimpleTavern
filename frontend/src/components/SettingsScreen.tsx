import { useState, useEffect, useCallback } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft, BookOpen, ChevronRight, Wifi, Check, X } from 'lucide-react';
import {
  loadChatSettings,
  saveChatSettings,
  type ChatSettings,
  type ResponseLength,
} from '../utils/chatSettings';

interface SettingsScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

interface ProviderItem {
  id: string;
  name: string;
  model?: string;
  isLocal?: boolean;
  active?: boolean;
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  const [syncedCloud, setSyncedCloud] = useState(true);
  const [ambientAudio, setAmbientAudio] = useState(false);
  const [renderQuality, setRenderQuality] = useState<'high' | 'medium' | 'low'>('high');

  // 聊天生成设置
  const [chatSettings, setChatSettings] = useState<ChatSettings>(() => loadChatSettings());
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [serverActive, setServerActive] = useState<string | null>(null);

  // 连接测试状态
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    fetch('/api/users/settings', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data?.settings) {
          if (data.settings.cloudBackup !== undefined) setSyncedCloud(data.settings.cloudBackup);
          if (data.settings.autoPlayAudio !== undefined) setAmbientAudio(data.settings.autoPlayAudio);
          if (data.settings.renderQuality) setRenderQuality(data.settings.renderQuality);
        }
      })
      .catch(() => {});

    fetch('/api/chat/providers', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const list: ProviderItem[] = Array.isArray(data?.providers) ? data.providers : [];
        setProviders(list);
        setServerActive(data?.active ?? null);
        // 无本地偏好且服务端默认是本地模型时，自动切到首个云端
        const saved = loadChatSettings();
        if (!saved.providerId) {
          const serverDefault = list.find((p) => p.id === data?.active);
          if (serverDefault?.isLocal) {
            const cloud = list.find((p) => !p.isLocal);
            if (cloud) {
              setChatSettings(saveChatSettings({ providerId: cloud.id }));
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  const saveServerSettings = (updates: Record<string, unknown>) => {
    fetch('/api/users/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ settings: updates }),
    }).catch(() => {});
  };

  const updateChat = useCallback((partial: Partial<ChatSettings>) => {
    setChatSettings(saveChatSettings(partial));
  }, []);

  const testConnection = useCallback(async () => {
    setTestState('testing');
    setTestError('');
    setTestResult('');
    try {
      const resp = await fetch('/api/chat/providers', { credentials: 'include' });
      if (resp.ok) {
        const data = await resp.json();
        setTestState('success');
        const list = data?.providers || [];
        setProviders(list);
        setServerActive(data?.active ?? null);
        setTestResult(list.length ? `已连接，${list.length} 个模型可用` : '已连接');
      } else {
        setTestState('error');
        setTestError(`服务器返回 ${resp.status}`);
      }
    } catch (err: unknown) {
      setTestState('error');
      setTestError(err instanceof Error ? err.message : '无法连接到服务器');
    }
  }, []);

  const selectedProvider = chatSettings.providerId || serverActive;

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#090A0F] text-[#E0E0E6] safe-content-bottom animate-subtle-fadeIn">
      <div className="absolute top-1/4 -left-10 w-48 h-48 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-10 w-48 h-48 bg-accent-purple opacity-5 blur-[100px] pointer-events-none" />

      <header className="sticky top-0 z-40 bg-[#0F111A]/90 backdrop-blur-md px-6 h-16 flex items-center justify-between border-b border-white/5">
        <button
          onClick={() => onNavigate(ScreenId.PROFILE)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">返回</span>
        </button>
        <span className="font-bold text-sm tracking-widest text-[#ffd8ee] font-headline-lg-mobile">
          设置中心
        </span>
        <div className="w-10" />
      </header>

      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">

        {/* 模型与生成 — 影响聊天质量的核心设置 */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            模型与生成 (LLM)
          </h3>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl space-y-3">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">对话模型</h4>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                本地模型可能较慢；优先选择云端以获得更快首字与更好回复。
              </p>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {providers.length === 0 && (
                <p className="text-[10px] text-on-surface-variant/60">暂无可用模型，请检查后端配置</p>
              )}
              {providers.map((p) => {
                const isSelected = selectedProvider === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => updateChat({ providerId: p.id })}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-accent-pink/50 bg-accent-pink/10'
                        : 'border-outline-variant/20 bg-surface-elevated/40 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-accent-pink' : 'text-white'}`}>
                        {p.name}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                        p.isLocal ? 'bg-amber-500/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'
                      }`}>
                        {p.isLocal ? '本地' : '云端'}
                      </span>
                    </div>
                    <p className="text-[9px] text-on-surface-variant/70 font-mono mt-0.5 truncate">
                      {p.model || p.id}
                      {p.active || serverActive === p.id ? ' · 服务端默认' : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl space-y-3">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">回复长度</h4>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                控制单次生成的大致篇幅（映射 max_tokens）。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs text-center font-mono font-bold">
              {([
                ['short', '短'],
                ['medium', '中'],
                ['long', '长'],
              ] as [ResponseLength, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => updateChat({ responseLength: key })}
                  className={`py-2 px-3 rounded-lg border text-[10px] cursor-pointer transition-colors ${
                    chatSettings.responseLength === key
                      ? 'border-accent-pink text-accent-pink bg-accent-pink/5'
                      : 'border-outline-variant/20 text-on-surface-variant bg-surface-elevated/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-white">温度 (Temperature)</h4>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  越高越发散，越低越稳。当前 {chatSettings.temperature.toFixed(1)}
                </p>
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.1}
              value={chatSettings.temperature}
              onChange={(e) => updateChat({ temperature: Number(e.target.value) })}
              className="w-full accent-pink-400"
            />
          </div>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl space-y-2">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">你的称呼 ({'{{user}}'})</h4>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                角色卡中的 {'{{user}}'} 会替换为该名称。
              </p>
            </div>
            <input
              type="text"
              value={chatSettings.userName}
              onChange={(e) => updateChat({ userName: e.target.value })}
              placeholder="默认使用登录名或「你」"
              className="w-full bg-surface-elevated/60 border border-outline-variant/30 rounded-lg px-3 py-2 text-xs text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink/50"
            />
          </div>
        </div>

        {/* 会话偏好 */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            会话偏好配置 (DIALOGS SEEDS)
          </h3>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">云端神经元备份</h4>
              <p className="text-[10px] text-on-surface-variant max-w-[200px] leading-relaxed">
                全自动实时上传在 Yuzu AI 的对话记忆条目，防丢失。
              </p>
            </div>
            <button
              onClick={() => { const next = !syncedCloud; setSyncedCloud(next); saveServerSettings({ cloudBackup: next }); }}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                syncedCloud ? 'bg-accent-pink' : 'bg-gray-700'
              } cursor-pointer`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  syncedCloud ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">进站自动播放朗读机制</h4>
              <p className="text-[10px] text-on-surface-variant max-w-[200px] leading-relaxed">
                在接收 AI 突触反馈时，默认自动触发合成配音发音（仿真声呐模式）。
              </p>
            </div>
            <button
              onClick={() => { const next = !ambientAudio; setAmbientAudio(next); saveServerSettings({ autoPlayAudio: next }); }}
              className={`w-11 h-6 rounded-full relative transition-colors ${
                ambientAudio ? 'bg-accent-pink' : 'bg-gray-700'
              } cursor-pointer`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${
                  ambientAudio ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            系统级参数 (CORE ENVIRONMENT)
          </h3>

          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl space-y-4">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">拟态渲染质量 (Quality)</h4>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                调整大厅炫彩高能粒子动画的渲染负荷。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-xs text-center font-mono font-bold">
              {['high', 'medium', 'low'].map((q) => (
                <button
                  key={q}
                  onClick={() => { setRenderQuality(q as 'high' | 'medium' | 'low'); saveServerSettings({ renderQuality: q }); }}
                  className={`py-2 px-3 rounded-lg border text-[10px] whitespace-nowrap cursor-pointer transition-colors ${
                    renderQuality === q
                      ? 'border-accent-pink text-accent-pink bg-accent-pink/5'
                      : 'border-outline-variant/20 text-on-surface-variant bg-surface-elevated/40'
                  }`}
                >
                  {q === 'high' ? '🚀 极佳' : q === 'medium' ? '⚡ 均衡' : '🔋 节能'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            世界书管理 (WORLDBOOK)
          </h3>
          <button
            onClick={() => onNavigate(ScreenId.WORLD_BOOK_MANAGE)}
            className="w-full bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl flex items-center justify-between hover:border-accent-purple/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent-purple/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-accent-purple" />
              </div>
              <div className="text-left space-y-0.5">
                <h4 className="text-xs font-semibold text-white">管理世界书</h4>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  创建、编辑和导入世界书条目，控制 AI 对话上下文注入
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-accent-purple transition-colors" />
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            后端连接 (BACKEND LINK)
          </h3>
          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl space-y-3">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">连通性测试</h4>
              <p className="text-[10px] text-on-surface-variant leading-relaxed">
                验证前端与后端 API 的连接状态，确保聊天和角色加载正常。
              </p>
            </div>
            <button
              onClick={testConnection}
              disabled={testState === 'testing'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-surface-elevated/60 hover:border-accent-pink/40 text-xs text-on-surface hover:text-accent-pink transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wifi className={`w-3.5 h-3.5 ${testState === 'testing' ? 'animate-pulse' : ''}`} />
              {testState === 'testing' ? '测试中...' : '测试连接'}
            </button>
            {testState === 'success' && (
              <div className="flex items-center gap-2 text-[10px] text-accent-green font-mono">
                <Check className="w-3.5 h-3.5" />
                <span>{testResult}</span>
              </div>
            )}
            {testState === 'error' && (
              <div className="flex items-center gap-2 text-[10px] text-red-400 font-mono">
                <X className="w-3.5 h-3.5" />
                <span>{testError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-elevated/30 border border-outline-variant/10 p-4 rounded-xl space-y-2 text-[10px] text-on-surface-variant leading-relaxed text-center font-mono">
          <p>柚姬AI 部署单元: 霓虹客户端 V2.0</p>
          <p>授权入口: 正常-2099</p>
          <p>状态: 神经核心流活跃</p>
        </div>
      </main>
    </div>
  );
}
