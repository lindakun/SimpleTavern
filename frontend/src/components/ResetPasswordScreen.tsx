import { useState, useEffect } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { useUserApi } from '../api/users';

interface ResetPasswordScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function ResetPasswordScreen({ onNavigate }: ResetPasswordScreenProps) {
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userApi = useUserApi();

  // 从 sessionStorage 恢复 handle
  useEffect(() => {
    const savedHandle = sessionStorage.getItem('reset_password_handle');
    if (savedHandle) {
      setHandle(savedHandle);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!handle.trim() || !code.trim() || !newPassword) {
      setError('请填写所有必填字段');
      return;
    }

    if (newPassword.length < 6) {
      setError('新密码至少需要 6 个字符');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await userApi.resetPassword(handle.trim(), code.trim(), newPassword);
      sessionStorage.removeItem('reset_password_handle');
      onNavigate(ScreenId.EMAIL_LOGIN);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '密码重置失败，请重试';
      setError(message);
      setLoading(false);
    }
  };

  const isValid = handle.trim() && code.trim() && newPassword && confirmPassword;

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-background-deep p-6">
      {/* Glow Rings */}
      <div className="absolute top-1/4 -left-10 w-40 h-40 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-10 w-60 h-60 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Top Bar */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 flex items-center justify-between px-6 h-16 bg-background-deep/80 backdrop-blur-xl border-b border-outline-variant/30 safe-top">
        <button
          onClick={() => onNavigate(ScreenId.FORGOT_PASSWORD)}
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
        <h1 className="font-headline-lg-mobile text-lg font-bold text-accent-pink text-center">重置密码</h1>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center pt-28 pb-12 w-full max-w-md mx-auto z-10">
        {/* Icon */}
        <div className="relative w-28 h-28 mb-6 group">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-pink to-accent-purple opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-accent-pink/50 p-1 bg-surface">
            <div className="w-full h-full rounded-full bg-surface-elevated flex items-center justify-center">
              <KeyRound className="w-10 h-10 text-accent-pink" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent-pink px-3 py-0.5 rounded-full shadow-lg">
            <span className="text-[9px] font-bold text-on-primary-fixed uppercase tracking-wider font-mono">RESET</span>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2 font-headline-lg-mobile">设置新密码</h2>
          <p className="text-xs text-on-surface-variant">输入从服务器控制台获取的恢复码和新密码</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {error && (
            <div className="bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          {/* Handle - pre-filled, editable */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-handle">
              用户名
            </label>
            <div className="relative">
              <input
                id="reset-handle"
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="输入用户名"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
              />
              <span className="font-mono text-sm absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">@</span>
            </div>
          </div>

          {/* Recovery Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-code">
              恢复码
            </label>
            <input
              id="reset-code"
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="输入6位恢复码"
              maxLength={6}
              className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md font-mono tracking-widest"
            />
          </div>

          {/* New Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-new-password">
              新密码
            </label>
            <div className="relative">
              <input
                id="reset-new-password"
                type={showPass ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少6位字符"
                minLength={6}
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-3.5 pr-10 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
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

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-confirm-password">
              确认新密码
            </label>
            <div className="relative">
              <input
                id="reset-confirm-password"
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-3.5 pr-10 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isValid}
            className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3.5 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>重置中...</span>
            ) : (
              <>
                <span>重置密码</span>
                <KeyRound className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </form>

        {/* Redirect to login */}
        <p className="text-xs text-on-surface-variant text-center mt-6">
          想起密码了？{' '}
          <button
            onClick={() => onNavigate(ScreenId.EMAIL_LOGIN)}
            className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
          >
            返回登录
          </button>
        </p>
      </main>
    </div>
  );
}
