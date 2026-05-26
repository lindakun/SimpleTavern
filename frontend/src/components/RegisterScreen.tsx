import React, { useState } from 'react';
import { ScreenId } from '../types';
import { ArrowLeft, ChevronLeft } from 'lucide-react';

interface RegisterScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onRegister: (username: string, email: string, password?: string) => void;
}

export default function RegisterScreen({ onNavigate, onRegister }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !email.trim()) return;
    onRegister(username, email, password);
    onNavigate(ScreenId.DISCOVER);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background-deep p-6">
      {/* Glow */}
      <div className="absolute top-1/3 -left-10 w-48 h-48 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 -right-10 w-48 h-48 bg-accent-purple opacity-5 blur-[100px] pointer-events-none" />

      {/* Header with arrow_back */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 flex items-center justify-between px-6 h-16 bg-background-deep/80 backdrop-blur-xl border-b border-outline-variant/30">
        <button
          onClick={() => onNavigate(ScreenId.WELCOME)}
          className="flex items-center gap-1.5 pl-2 pr-3 py-1.5 rounded-full bg-surface-container/60 hover:bg-surface-elevated border border-accent-pink/30 hover:border-accent-pink/60 transition-all duration-200 cursor-pointer text-white shadow-[0_0_10px_rgba(232,121,199,0.1)] group/back"
        >
          <ChevronLeft className="w-3.5 h-3.5 text-accent-pink group-hover/back:-translate-x-0.5 transition-transform" />
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNJkIhL5VgrhIzVuQ-pQ9KjmstVrmxacrtGuB0W8LG1Wuj4MsAGn2nzXGu37GIac8AMsRYcOSrQ_BDfkoOxhF0_SX5zJ9vH8F2UKfZuX97jvw5ZC877pAQelU8AKYQSJKeSw49A3iQEM_3kaz6lGI4QuKTsB2J7p5GIVykxFsz_YHCd4FJ8Vos12aPC8BXhAOK86roItVXfexuUZM7tBC73wfLoRPLcCRbsfxlOWSwDiq5jkoo4VyvLzbLti0o-zgXjsJkOZV8JQ"
            alt="Yuzu AI Logo"
            referrerPolicy="no-referrer"
            className="w-4 h-4 rounded-full object-cover border border-accent-pink/40"
          />
          <span className="text-[11px] font-bold tracking-wide text-[#ffade2]">返回</span>
        </button>
        <h1 className="font-headline-lg-mobile text-lg font-bold text-accent-pink text-center">注册账号</h1>
        <div className="w-10" />
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-12 w-full max-w-md mx-auto z-10">
        {/* Animated join head banner image */}
        <div className="relative w-32 h-32 mb-6 rounded-full overflow-hidden border-2 border-accent-pink/50 shadow-[0_0_20px_rgba(232,121,199,0.3)]">
          <img
            alt="Join Header Portrait"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNJkIhL5VgrhIzVuQ-pQ9KjmstVrmxacrtGuB0W8LG1Wuj4MsAGn2nzXGu37GIac8AMsRYcOSrQ_BDfkoOxhF0_SX5zJ9vH8F2UKfZuX97jvw5ZC877pAQelU8AKYQSJKeSw49A3iQEM_3kaz6lGI4QuKTsB2J7p5GIVykxFsz_YHCd4FJ8Vos12aPC8BXhAOK86roItVXfexuUZM7tBC73wfLoRPLcCRbsfxlOWSwDiq5jkoo4VyvLzbLti0o-zgXjsJkOZV8JQ"
          />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2 font-headline-lg-mobile">加入霓虹边境</h2>
          <p className="text-xs text-on-surface-variant">立即开启您的柚姬AI之旅</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleRegister} className="w-full space-y-5 bg-surface-container/60 p-6 rounded-2xl border border-outline-variant/30 backdrop-blur-xl">
          <div className="space-y-1.5 animate-subtle-fadeIn">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">用户名</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="输入您的酷名"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2.5 text-white text-xs outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">电子邮箱</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@yuzu.ai"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2.5 text-white text-xs outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">密码</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2.5 text-white text-xs outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl text-xs font-bold shadow-[0_4px_20px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 cursor-pointer"
          >
            注册
          </button>

          <div className="w-full flex items-center gap-4 py-2">
            <div className="h-[1px] flex-1 bg-outline-variant/20" />
            <span className="text-[9px] text-on-surface-variant/40 uppercase font-mono">或者通过以下方式注册</span>
            <div className="h-[1px] flex-1 bg-outline-variant/20" />
          </div>

          {/* Social Sign-up */}
          <button
            type="button"
            onClick={() => {
              onRegister('Neon_Pilot', 'pilot@yuzu.ai', 'password123');
              onNavigate(ScreenId.DISCOVER);
            }}
            className="w-full h-11 flex items-center justify-center gap-2 bg-surface-elevated/40 border border-outline-variant/50 hover:bg-surface-elevated/80 rounded-xl text-xs text-white transition-colors cursor-pointer"
          >
            <span className="font-semibold">通过 Google 注册</span>
          </button>
        </form>

        {/* Existing user trigger -> login view via 立即登录 */}
        <p className="text-xs text-on-surface-variant text-center mt-6">
          已有账号？{' '}
          <a
            onClick={(e) => {
              e.preventDefault();
              onNavigate(ScreenId.EMAIL_LOGIN);
            }}
            href="#login"
            className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
          >
            立即登录
          </a>
        </p>

        <p className="text-[10px] text-on-surface-variant/40 text-center mt-8">
          注册即代表您同意我们的 <br />
          <a href="#terms" className="underline hover:text-accent-pink">服务条款</a> 与 <a href="#privacy" className="underline hover:text-accent-pink">隐私政策</a>
        </p>
      </main>
    </div>
  );
}
