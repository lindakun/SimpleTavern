import React, { useState } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface HelpFeedbackScreenProps {
  faqs: FAQItem[];
  onNavigate: (screen: ScreenId) => void;
}

export default function HelpFeedbackScreen({ faqs, onNavigate }: HelpFeedbackScreenProps) {
  const [activeFaqId, setActiveFaqId] = useState<string | null>(null);
  const [feedbackCategory, setFeedbackCategory] = useState('neural_dialog');
  const [message, setMessage] = useState('');

  const handleToggleFaq = (id: string) => {
    setActiveFaqId(activeFaqId === id ? null : id);
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      alert('请先输入反馈或申诉描述内容！');
      return;
    }

    alert('🎉 您的申诉与反馈已被 Yuzu AI 安全审计终端记录，我们将于 24 小时内完成神经元核对！');
    setMessage('');
  };

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#090A0F] text-[#E0E0E6] safe-content-bottom">
      {/* Glow decorations */}
      <div className="absolute top-0 left-0 w-80 h-80 bg-accent-pink/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-80 h-80 bg-accent-purple/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top sticky header conforming with: //button[.//span[text()='chevron_left']] */}
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
          帮助与反馈
        </span>
        <div className="w-10" />
      </header>

      {/* Main Container */}
      <main className="max-w-xl mx-auto px-6 py-6 space-y-8 relative z-10 select-none">
        
        {/* FAQs List section */}
        <div className="space-y-4 animate-subtle-fadeIn">
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            常见数字终端疑答 (FAQ)
          </h2>

          <div className="space-y-3">
            {faqs.map((faq) => {
              const isOpen = activeFaqId === faq.id;
              return (
                <div
                  key={faq.id}
                  className="bg-surface-container/60 border border-outline-variant/20 rounded-xl overflow-hidden transition-all duration-300"
                >
                  <button
                    onClick={() => handleToggleFaq(faq.id)}
                    className="w-full text-left p-4 flex items-center justify-between cursor-pointer focus:outline-none hover:bg-surface-container duration-150"
                  >
                    <span className="text-xs font-bold text-white pr-4 leading-normal">{faq.question}</span>
                    <ChevronRight className={`text-xs text-accent-pink transform transition-transform duration-200 w-4 h-4 ${isOpen ? 'rotate-90' : ''}`} />
                  </button>

                  <div
                    className={`transition-all duration-300 overflow-hidden ${
                      isOpen ? 'max-h-40 border-t border-outline-variant/10 p-4' : 'max-h-0'
                    }`}
                  >
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feedback appeal submission form area */}
        <div className="space-y-4 pt-4 border-t border-outline-variant/15">
          <h2 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest font-mono">
            反馈与申诉通道 (APPLICATIONS)
          </h2>

          <form onSubmit={handleFeedbackSubmit} className="bg-surface-container/60 border border-outline-variant/20 p-5 rounded-2xl space-y-4 backdrop-blur-md">
            
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                反馈分类
              </label>
              <div className="grid grid-cols-2 gap-2 text-xs text-center font-mono font-bold">
                {[
                  { id: 'neural_dialog', label: '🧠 记忆突触对齐' },
                  { id: 'payment_appeal', label: '💳 支付/账户申诉' },
                  { id: 'voice_bug', label: '🔊 模拟高频配音异常' },
                  { id: 'suggestion', label: '💡 开发优化建议' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFeedbackCategory(cat.id)}
                    className={`py-2 px-3 rounded-lg border text-[10px] whitespace-nowrap cursor-pointer transition-colors ${
                      feedbackCategory === cat.id
                        ? 'border-accent-pink text-accent-pink bg-accent-pink/5'
                        : 'border-outline-variant/20 text-on-surface-variant bg-surface-elevated/40'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider font-mono">
                问题详细阐述 / 申诉说明
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="请尽可能详细描述您数字特工遇到的故障对齐，或写下关于柚姬AI的各项优化建议。我们将安排程序员小哥第一时间优化神经网络..."
                rows={4}
                className="w-full bg-surface-elevated border border-outline-variant/30 rounded-xl p-3 text-xs text-white placeholder:text-on-surface-variant/40 outline-none focus:border-accent-pink transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl text-xs font-bold shadow-[0_4px_15px_rgba(232,121,199,0.35)] active:scale-95 duration-200 transition-transform cursor-pointer"
            >
              提交反馈与申诉
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
