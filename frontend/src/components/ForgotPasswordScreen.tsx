import { useState } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft, Mail } from 'lucide-react';
import { useUserApi } from '../api/users';

interface ForgotPasswordScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userApi = useUserApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setLoading(true);
    setError('');
    try {
      await userApi.recoverPassword(handle.trim());
      sessionStorage.setItem('reset_password_handle', handle.trim());
      onNavigate(ScreenId.RESET_PASSWORD);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请求失败，请重试';
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-background-deep p-6">
      {/* Glow Rings */}
      <div className="absolute top-1/4 -left-10 w-40 h-40 bg-accent-pink opacity-5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-10 w-60 h-60 bg-accent-purple opacity-5 blur-[120px] pointer-events-none" />

      {/* Top Bar */}
      <header className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 flex items-center justify-between px-6 h-16 bg-background-deep/80 backdrop-blur-xl border-b border-outline-variant/30 safe-top">
        <button
          onClick={() => onNavigate(ScreenId.EMAIL_LOGIN)}
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
        <h1 className="font-headline-lg-mobile text-lg font-bold text-accent-pink text-center">忘记密码</h1>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center pt-28 pb-12 w-full max-w-md mx-auto z-10">
        {/* Icon */}
        <div className="relative w-28 h-28 mb-6 group">
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-pink to-accent-purple opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-accent-pink/50 p-1 bg-surface">
            <div className="w-full h-full rounded-full bg-surface-elevated flex items-center justify-center">
              <Mail className="w-10 h-10 text-accent-pink" />
            </div>
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent-pink px-3 py-0.5 rounded-full shadow-lg">
            <span className="text-[9px] font-bold text-on-primary-fixed uppercase tracking-wider font-mono">RECOVERY</span>
          </div>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2 font-headline-lg-mobile">找回你的账号</h2>
          <p className="text-xs text-on-surface-variant">输入用户名，系统将生成恢复码并显示在服务器控制台中</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full space-y-5">
          {error && (
            <div className="bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="forgot-handle">
              用户名
            </label>
            <div className="relative">
              <input
                id="forgot-handle"
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="输入你的用户名"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-3.5 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
              />
              <span className="font-mono text-sm absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">@</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !handle.trim()}
            className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3.5 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span>发送中...</span>
            ) : (
              <>
                <span>发送恢复码</span>
                <Mail className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 p-4 rounded-xl bg-surface-elevated/20 border border-outline-variant/20">
          <p className="text-[10px] text-on-surface-variant/60 leading-relaxed text-center">
            恢复码将在服务器控制台中显示。开发环境下请查看 Docker 日志或终端输出获取恢复码。
            生产环境下恢复码将通过注册邮箱发送。
          </p>
        </div>

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
