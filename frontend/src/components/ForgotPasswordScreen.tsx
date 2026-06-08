import { useState, useRef, useCallback } from 'react';
import { ScreenId } from '../types';
import { Mail, KeyRound } from 'lucide-react';
import { useUserApi } from '../api/users';
import AuthLayout from './AuthLayout';

interface ForgotPasswordScreenProps {
  onNavigate: (screen: ScreenId) => void;
}

export default function ForgotPasswordScreen({ onNavigate }: ForgotPasswordScreenProps) {
  const [handle, setHandle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const userApi = useUserApi();
  const handleRef = useRef<HTMLInputElement>(null);

  const handleFocusScroll = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  }, []);

  const isSmallScreen = typeof window !== 'undefined' && window.innerHeight < 700;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setLoading(true);
    setError('');
    try {
      await userApi.recoverPassword(handle.trim());
      sessionStorage.setItem('reset_password_handle', handle.trim());
      setSent(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请求失败，请重试';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const footer = sent ? (
    <button
      onClick={() => onNavigate(ScreenId.RESET_PASSWORD)}
      className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
    >
      <span>前往重置密码</span>
      <KeyRound className="w-4 h-4 text-white" />
    </button>
  ) : (
    <form id="forgot-form" onSubmit={handleSubmit} className="w-full">
      <button
        type="submit"
        disabled={loading || !handle.trim()}
        className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
  );

  return (
    <AuthLayout title="忘记密码" onBack={() => onNavigate(ScreenId.LOGIN)} footer={footer}>
      {/* Icon */}
      <div className={`relative mb-2 sm:mb-3 group ${isSmallScreen ? 'w-20 h-20' : 'w-24 h-24'}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-pink to-accent-purple opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-accent-pink/50 p-1 bg-surface">
          <div className="w-full h-full rounded-full bg-surface-elevated flex items-center justify-center">
            <Mail className={`${isSmallScreen ? 'w-7 h-7' : 'w-10 h-10'} text-accent-pink`} />
          </div>
        </div>
        {!isSmallScreen && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent-pink px-3 py-0.5 rounded-full shadow-lg">
            <span className="text-[9px] font-bold text-on-primary-fixed uppercase tracking-wider font-mono">RECOVERY</span>
          </div>
        )}
      </div>

      {/* Heading */}
      <div className="text-center mb-3 sm:mb-4">
        <h2 className={`font-bold text-white mb-1 font-headline-lg-mobile ${isSmallScreen ? 'text-lg' : 'text-xl'}`}>找回你的账号</h2>
        <p className="text-xs text-on-surface-variant">输入用户名，系统将生成恢复码供你重置密码</p>
      </div>

      {sent ? (
        /* 发送成功状态 */
        <div className="w-full space-y-3">
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs px-4 py-3 rounded-xl">
            ✅ 恢复码已生成！请联系管理员获取你的恢复码。
          </div>
          <div className="bg-surface-elevated/20 border border-outline-variant/20 p-4 rounded-xl space-y-2">
            <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
              恢复码已生成并记录在服务器端。请联系站点管理员获取恢复码，然后在下一步输入恢复码和新密码完成重置。
            </p>
            <p className="text-[10px] text-on-surface-variant/60 leading-relaxed">
              恢复码有效期为 5 分钟，请尽快使用。
            </p>
          </div>
        </div>
      ) : (
        <>
          {error && (
            <div className="w-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
              {error}
            </div>
          )}

          <div className="w-full space-y-1">
            <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="forgot-handle">
              用户名
            </label>
            <div className="relative">
              <input
              form="forgot-form"
              ref={handleRef}
              id="forgot-handle"
                type="text"
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                onFocus={() => handleFocusScroll(handleRef.current)}
                placeholder="输入你的用户名"
                className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2.5 sm:py-3 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
              />
              <span className="font-mono text-sm absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">@</span>
            </div>
          </div>
        </>
      )}

      {/* Help Text */}
      <div className="mt-3 p-3 sm:p-4 rounded-xl bg-surface-elevated/20 border border-outline-variant/20 w-full">
        <p className="text-[10px] text-on-surface-variant/60 leading-relaxed text-center">
          恢复码由服务器生成，请联系站点管理员获取。恢复码有效期为 5 分钟。
        </p>
      </div>

      {/* Redirect to login */}
      <p className="text-xs text-on-surface-variant text-center mt-2">
        想起密码了？{' '}
        <button
          onClick={() => onNavigate(ScreenId.LOGIN)}
          className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
        >
          返回登录
        </button>
      </p>
    </AuthLayout>
  );
}
