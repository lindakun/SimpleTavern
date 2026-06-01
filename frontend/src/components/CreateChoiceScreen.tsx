import React, { useState } from 'react';
import { ScreenId } from '../types';
import { X, Zap, Edit, Sparkles } from 'lucide-react';
import { useToast } from './Toast';

interface CreateChoiceScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function CreateChoiceScreen({ onNavigate }: CreateChoiceScreenProps) {
  const { showToast } = useToast();
  const [importing, setImporting] = useState(false);

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#090A0F] text-[#E0E0E6] flex flex-col justify-between p-6">
      {/* Heavy colorful blur backgrounds */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-accent-pink/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top close bar */}
      <header className="flex justify-between items-center h-16 relative z-10 w-full mb-8">
        <h1 className="text-lg font-bold text-white tracking-widest font-headline-lg-mobile bg-gradient-to-r from-accent-pink to-accent-purple bg-clip-text text-transparent">
          创建方式选择
        </h1>
        <button
          onClick={() => onNavigate(ScreenId.DISCOVER)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <X className="w-3.5 h-3.5 text-accent-pink group-hover/back:rotate-90 transition-transform duration-200" />
          <img
            src="/yuzuai_logo.png"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">关闭</span>
        </button>
      </header>

      {/* Main Container Selection panel */}
      <main className="flex-grow flex flex-col justify-center max-w-md w-full mx-auto relative z-10 space-y-6">
        <div className="text-center space-y-2 mb-4">
          <span className="text-[10px] font-bold text-accent-pink uppercase font-mono tracking-widest bg-accent-pink/10 border border-accent-pink/20 px-3 py-1 rounded-full">
            NEURAL_CREATOR_V1.0
          </span>
          <h2 className="text-xl font-bold text-white font-headline-lg">您想如何塑造您的AI分身？</h2>
          <p className="text-xs text-on-surface-variant max-w-xs mx-auto">
            从头注入灵魂，或极速唤醒数字傀儡。让想象力跨越物理瓶颈。
          </p>
        </div>

        {/* Choice 1: Manual creator */}
        <div className="bg-surface-elevated/40 border border-accent-pink/30 hover:border-accent-pink p-6 rounded-3xl backdrop-blur-md shadow-[0_0_30px_rgba(232,121,199,0.05)] hover:shadow-[0_0_40px_rgba(232,121,199,0.15)] duration-300 flex flex-col justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-accent-pink/15 rounded-2xl flex items-center justify-center text-accent-pink text-lg font-mono flex-shrink-0">
              <Zap className="w-5 h-5 fill-accent-pink/20 text-accent-pink" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">从零创建角色</h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                填写角色名称、描述、性格、场景、第一条消息、系统提示词等完整 V3 角色卡信息。
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate(ScreenId.CREATE_CHARACTER)}
            className="w-full h-11 bg-gradient-to-r from-accent-pink to-accent-purple text-white rounded-xl text-xs font-bold active:scale-95 duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            <Edit className="w-3.5 h-3.5" />
            <span>开始创建</span>
          </button>
        </div>

        {/* Choice 2: Import from external file */}
        <div className="bg-surface-elevated/40 border border-outline-variant/30 hover:border-accent-purple/30 p-6 rounded-3xl backdrop-blur-md flex flex-col justify-between gap-4 opacity-75 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-accent-purple/15 rounded-2xl flex items-center justify-center text-accent-purple text-lg font-mono flex-shrink-0">
              <Sparkles className="w-5 h-5 fill-accent-purple/20 text-accent-purple" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">从外部导入</h3>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                支持导入 PNG 角色卡或 JSON 文件。自动识别 V1/V2/V3 格式，保留头像、设定等完整信息。
              </p>
            </div>
          </div>

          <label className={`w-full h-11 bg-surface-container border border-outline-variant hover:border-accent-purple text-xs text-on-surface rounded-xl font-bold active:scale-95 transition-transform cursor-pointer flex items-center justify-center gap-2 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="file"
              accept=".png,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setImporting(true);
                const formData = new FormData();
                formData.append('file', file);

                try {
                  const res = await fetch('/api/characters/import', {
                    method: 'POST',
                    body: formData,
                  });
                  if (res.ok) {
                    const data = await res.json();
                    showToast(`导入成功: ${data.path}`, 'success');
                    onNavigate(ScreenId.MY_CHARACTERS);
                  } else {
                    const err = await res.json().catch(() => ({}));
                    showToast(`导入失败: ${err.message || err.error || '未知错误'}`, 'error');
                  }
                } catch {
                  showToast('导入失败: 网络错误', 'error');
                } finally {
                  setImporting(false);
                }
              }}
            />
            <Sparkles className="w-3.5 h-3.5" />
            {importing ? '导入中...' : '选择文件导入'}
          </label>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-4 text-center">
        <span className="text-[10px] text-on-surface-variant/40 font-mono tracking-widest block">
          CRAFTED BY YUZU INTELLIGENCE DEVELOPMENT GROUP
        </span>
      </footer>
    </div>
  );
}
