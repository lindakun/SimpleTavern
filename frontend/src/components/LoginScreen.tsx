import { useState, useRef, useCallback } from 'react';
import { ScreenId } from '../types';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { openGoogleOAuthPopup } from '../api/google-oauth';
import AuthLayout from './AuthLayout';

interface LoginScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onLogin: (input: string, password?: string) => void;
  onGoogleLogin: (idToken: string) => void;
}

export default function LoginScreen({ onNavigate, onLogin, onGoogleLogin }: LoginScreenProps) {
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const handleInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // 键盘 focus 时自动滚动到输入框
  const handleFocusScroll = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  }, []);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    openGoogleOAuthPopup(
      async (result) => {
        try {
          await onGoogleLogin(result.idToken);
          onNavigate(ScreenId.DISCOVER);
        } finally {
          setGoogleLoading(false);
        }
      },
      () => {
        setGoogleLoading(false);
      },
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      await onLogin(handle, password);
      onNavigate(ScreenId.DISCOVER);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '登录失败，请重试';
      setLoginError(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const isSmallScreen = typeof window !== 'undefined' && window.innerHeight < 700;

  const footer = (
    <form id="login-form" onSubmit={handleSubmit} className="w-full">
      <button
        type="submit"
        disabled={loginLoading}
        className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loginLoading ? (
          <span>登录中...</span>
        ) : (
          <>
            <span>连接登录</span>
            <Zap className="w-4 h-4 text-white fill-white/20 animate-pulse" />
          </>
        )}
      </button>
    </form>
  );

  return (
    <AuthLayout title="登录" onBack={() => onNavigate(ScreenId.WELCOME)} footer={footer}>
      {/* Avatar badge - 响应式缩小 */}
      <div className={`relative mb-2 sm:mb-3 group ${isSmallScreen ? 'w-20 h-20' : 'w-24 h-24'}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-pink to-accent-purple opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-accent-pink/50 p-1 bg-surface">
          <img
            alt="Yuzu AI Avatar"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover rounded-full"
            src="/yuzuai_logo.png"
          />
        </div>
        {!isSmallScreen && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent-pink px-3 py-0.5 rounded-full shadow-lg">
            <span className="text-[9px] font-bold text-on-primary-fixed uppercase tracking-wider font-mono">AI ACTIVE</span>
          </div>
        )}
      </div>

      {/* Heading */}
      <div className="text-center mb-3 sm:mb-4">
        <h2 className={`font-bold text-white mb-1 font-headline-lg-mobile ${isSmallScreen ? 'text-lg' : 'text-xl'}`}>欢迎回来</h2>
        <p className="text-xs text-on-surface-variant">登录进入你的霓虹领地</p>
      </div>

      {/* 全局错误 */}
      {loginError && (
        <div className="w-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
          {loginError}
        </div>
      )}

      {/* Form Fields */}
      <div className="w-full space-y-3">
        {/* 用户名/邮箱 */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="login-handle">
            用户名或邮箱
          </label>
          <div className="relative">
            <input
              form="login-form"
              ref={handleInputRef}
              id="login-handle"
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onFocus={() => handleFocusScroll(handleInputRef.current)}
              placeholder="输入用户名或注册邮箱"
              className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
            />
            <span className="font-mono text-sm absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">@</span>
          </div>
        </div>

        {/* 密码 */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="login-password">
              密码
            </label>
            <button
              type="button"
              onClick={() => onNavigate(ScreenId.FORGOT_PASSWORD)}
              className="text-[10px] text-accent-pink hover:text-white transition-colors cursor-pointer"
            >
              忘记密码？
            </button>
          </div>
          <div className="relative">
            <input
              form="login-form"
              ref={passwordInputRef}
              id="login-password"
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => handleFocusScroll(passwordInputRef.current)}
              placeholder="••••••••"
              className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2.5 sm:py-3 pr-10 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="w-full flex items-center gap-3 my-2 sm:my-3">
        <div className="h-[1px] flex-1 bg-outline-variant/30" />
        <span className="text-[10px] text-on-surface-variant/60 font-semibold tracking-widest font-mono uppercase">或</span>
        <div className="h-[1px] flex-1 bg-outline-variant/30" />
      </div>

      {/* Google Login */}
      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={googleLoading}
        className="w-full bg-surface-elevated/40 py-2.5 sm:py-3 rounded-xl flex items-center justify-center border border-outline-variant hover:bg-surface-elevated/60 transition-colors gap-2 cursor-pointer disabled:opacity-50"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
        <span className="text-xs font-semibold text-white">{googleLoading ? '连接中...' : '使用 Google 登录'}</span>
      </button>

      {/* Redirect to register */}
      <p className="text-xs text-on-surface-variant text-center mt-2">
        还没有账号？{' '}
        <button
          onClick={() => onNavigate(ScreenId.REGISTER)}
          className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
        >
          立即注册
        </button>
      </p>
    </AuthLayout>
  );
}
