import { useState, useEffect } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft, BookOpen, ChevronRight } from 'lucide-react';

interface SettingsScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function SettingsScreen({ onNavigate }: SettingsScreenProps) {
  const [syncedCloud, setSyncedCloud] = useState(true);
  const [ambientAudio, setAmbientAudio] = useState(false);
  const [renderQuality, setRenderQuality] = useState<'high' | 'medium' | 'low'>('high');

  // 从后端加载设置
  useEffect(() => {
    fetch('/api/users/settings')
      .then(res => res.json())
      .then(data => {
        if (data?.settings) {
          if (data.settings.cloudBackup !== undefined) setSyncedCloud(data.settings.cloudBackup);
          if (data.settings.autoPlayAudio !== undefined) setAmbientAudio(data.settings.autoPlayAudio);
          if (data.settings.renderQuality) setRenderQuality(data.settings.renderQuality);
        }
      })
      .catch(() => {});
  }, []);

  // 保存设置到后端
  const saveSettings = (updates: Record<string, unknown>) => {
    fetch('/api/users/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: updates }),
    }).catch(() => {});
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#090A0F] text-[#E0E0E6] safe-content-bottom animate-subtle-fadeIn">
      {/* Background neon style decoration */}
      <div className="absolute top-1/4 -left-10 w-48 h-48 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-10 w-48 h-48 bg-accent-purple opacity-5 blur-[100px] pointer-events-none" />

      {/* Top Header matching xpath: //button[.//span[text()='chevron_left']] in screen specifications */}
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

      {/* Settings Options container */}
      <main className="max-w-xl mx-auto px-6 py-6 space-y-6 relative z-10 select-none">
        
        {/* Section 1 */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            会话偏好配置 (DIALOGS SEEDS)
          </h3>

          {/* Setting Cell 1: Sync to cloud */}
          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">云端神经元备份</h4>
              <p className="text-[10px] text-on-surface-variant max-w-[200px] leading-relaxed">
                全自动实时上传在 Yuzu AI 的对话记忆条目，防丢失。
              </p>
            </div>
            <button
              onClick={() => { const next = !syncedCloud; setSyncedCloud(next); saveSettings({ cloudBackup: next }); }}
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

          {/* Setting Cell 2: Audio playback defaults */}
          <div className="bg-surface-container/60 border border-outline-variant/20 p-4 rounded-xl flex items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-white">进站自动播放朗读机制</h4>
              <p className="text-[10px] text-on-surface-variant max-w-[200px] leading-relaxed">
                在接收 AI 突触反馈时，默认自动触发合成配音发音（仿真声呐模式）。
              </p>
            </div>
            <button
              onClick={() => { const next = !ambientAudio; setAmbientAudio(next); saveSettings({ autoPlayAudio: next }); }}
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

        {/* Section 2 */}
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
                  onClick={() => { setRenderQuality(q as any); saveSettings({ renderQuality: q }); }}
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

        {/* 世界书管理 */}
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

        {/* Clean details banner */}
        <div className="bg-surface-elevated/30 border border-outline-variant/10 p-4 rounded-xl space-y-2 text-[10px] text-on-surface-variant leading-relaxed text-center font-mono">
          <p>YUZU-AI DEPLOYMENT UNIT: NEON_CLI_PRO_V2.0</p>
          <p>AUTHORIZED INGRESS: OK-2099</p>
          <p>STATUS: NEURAL_CORE_STREAM_ACTIVE</p>
        </div>
      </main>
    </div>
  );
}
