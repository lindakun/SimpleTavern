import React, { useState } from 'react';
import { ScreenId } from '../types';
import { ArrowLeft, Zap, GitBranch, Terminal, ChevronLeft } from 'lucide-react';

interface EmailLoginScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onLogin: (email: string, password?: string) => void;
}

export default function EmailLoginScreen({ onNavigate, onLogin }: EmailLoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    onLogin(email, password);
    onNavigate(ScreenId.DISCOVER);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-background-deep p-6">
      {/* Glow Rings */}
      <div className="absolute top-1/4 -left-10 w-40 h-40 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-10 w-60 h-60 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Top Bar Navigation */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 flex items-center justify-between px-6 h-16 bg-background-deep/80 backdrop-blur-xl border-b border-outline-variant/30">
        <button
          id="btn_back_welcome"
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
        <h1 className="font-headline-lg-mobile text-lg font-bold text-accent-pink text-center">Login</h1>
        <div className="w-10" />
      </header>

      {/* Main Form Fields */}
      <main className="flex-1 flex flex-col items-center justify-center pt-24 pb-12 w-full max-w-md mx-auto z-10">
        {/* Avatar badge */}
        <div className="relative w-32 h-32 mb-8 group">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-pink to-accent-purple opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-accent-pink/50 p-1 bg-surface">
            <img
              alt="Yuzu AI Avatar active"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover rounded-full"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNJkIhL5VgrhIzVuQ-pQ9KjmstVrmxacrtGuB0W8LG1Wuj4MsAGn2nzXGu37GIac8AMsRYcOSrQ_BDfkoOxhF0_SX5zJ9vH8F2UKfZuX97jvw5ZC877pAQelU8AKYQSJKeSw49A3iQEM_3kaz6lGI4QuKTsB2J7p5GIVykxFsz_YHCd4FJ8Vos12aPC8BXhAOK86roItVXfexuUZM7tBC73wfLoRPLcCRbsfxlOWSwDiq5jkoo4VyvLzbLti0o-zgXjsJkOZV8JQ"
            />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent-pink px-3 py-0.5 rounded-full shadow-lg">
            <span className="text-[9px] font-bold text-on-primary-fixed uppercase tracking-wider font-mono">AI ACTIVE</span>
          </div>
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white mb-2 font-headline-lg-mobile">Welcome Back</h2>
          <p className="text-xs text-on-surface-variant">Access your personalized neural sanctuary.</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface-variant flex items-center justify-between" htmlFor="email">
              用户名或邮箱
            </label>
            <div className="relative">
              <input
                id="email"
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="输入用户名或注册邮箱"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
              />
              <span className="font-mono text-sm absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">@</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-on-surface-variant" htmlFor="password">
                Password
              </label>
              <a href="#reset" className="text-xs text-accent-pink hover:text-white transition-colors">
                Forgot Password?
              </a>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-12/10 py-3 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white text-xs font-mono border-0 bg-transparent cursor-pointer"
              >
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          <div className="pt-4">
            <button
               type="submit"
               className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3.5 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
             >
               <span>Establish Connection</span>
               <Zap className="w-4 h-4 text-white fill-white/20 animate-pulse" />
             </button>
           </div>
         </form>

         {/* Separator / Options */}
         <div className="w-full flex items-center gap-4 my-8">
           <div className="h-[1px] flex-1 bg-outline-variant/30" />
           <span className="text-[10px] text-on-surface-variant/60 font-semibold tracking-widest font-mono uppercase">OR SYNC VIA</span>
           <div className="h-[1px] flex-1 bg-outline-variant/30" />
         </div>

         <div className="flex gap-4 w-full mb-8">
           <button
             type="button"
             className="flex-1 bg-surface-elevated/40 py-3 rounded-xl flex items-center justify-center border border-outline-variant hover:bg-surface-elevated/60 transition-colors gap-2"
           >
             <GitBranch className="w-4 h-4 text-accent-pink" />
             <span className="text-xs font-semibold text-white">GitHub</span>
           </button>
           <button
             type="button"
             className="flex-1 bg-surface-elevated/40 py-3 rounded-xl flex items-center justify-center border border-outline-variant hover:bg-surface-elevated/60 transition-colors gap-2"
           >
             <Terminal className="w-4 h-4 text-accent-purple" />
             <span className="text-xs font-semibold text-white">Terminal</span>
           </button>
         </div>

        {/* Redirect sign up */}
        <p className="text-xs text-on-surface-variant text-center">
          Don't have an account?{' '}
          <button
            onClick={() => onNavigate(ScreenId.REGISTER)}
            className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
          >
            Sign up
          </button>
        </p>
      </main>
    </div>
  );
}
