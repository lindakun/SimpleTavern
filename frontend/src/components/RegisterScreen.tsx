import { useState } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft } from 'lucide-react';
import { openGoogleOAuthPopup } from '../api/google-oauth';

interface RegisterScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onRegister: (username: string, email: string, password?: string) => void;
  onGoogleLogin: (idToken: string) => void;
}

export default function RegisterScreen({ onNavigate, onRegister, onGoogleLogin }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignup = () => {
    setGoogleLoading(true);
    openGoogleOAuthPopup(
      async (result) => {
        await onGoogleLogin(result.idToken);
        setGoogleLoading(false);
        onNavigate(ScreenId.DISCOVER);
      },
      () => {
        setGoogleLoading(false);
      },
    );
  };

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
            src="/yuzuai_logo.png"
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
            src="/yuzuai_logo.png"
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
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="w-full h-11 flex items-center justify-center gap-2 bg-surface-elevated/40 border border-outline-variant/50 hover:bg-surface-elevated/80 rounded-xl text-xs text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            <span className="font-semibold">{googleLoading ? '连接中...' : '通过 Google 注册'}</span>
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
