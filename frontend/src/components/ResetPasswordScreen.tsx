import { useState, useEffect, useRef, useCallback } from 'react';
import { ScreenId } from '../types';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { useUserApi } from '../api/users';
import AuthLayout from './AuthLayout';

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
  const handleRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleFocusScroll = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  }, []);

  const isSmallScreen = typeof window !== 'undefined' && window.innerHeight < 700;

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
      onNavigate(ScreenId.LOGIN);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '密码重置失败，请重试';
      setError(message);
      setLoading(false);
    }
  };

  const isValid = handle.trim() && code.trim() && newPassword && confirmPassword;

  const footer = (
    <form id="reset-form" onSubmit={handleSubmit} className="w-full">
      <button
        type="submit"
        disabled={loading || !isValid}
        className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl font-bold shadow-[0_4px_25px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
  );

  return (
    <AuthLayout title="重置密码" onBack={() => onNavigate(ScreenId.FORGOT_PASSWORD)} footer={footer}>
      {/* Icon */}
      <div className={`relative mb-2 sm:mb-3 group ${isSmallScreen ? 'w-20 h-20' : 'w-24 h-24'}`}>
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-accent-pink to-accent-purple opacity-20 blur-xl group-hover:opacity-40 transition-opacity duration-500" />
        <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-accent-pink/50 p-1 bg-surface">
          <div className="w-full h-full rounded-full bg-surface-elevated flex items-center justify-center">
            <KeyRound className={`${isSmallScreen ? 'w-7 h-7' : 'w-10 h-10'} text-accent-pink`} />
          </div>
        </div>
        {!isSmallScreen && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-accent-pink px-3 py-0.5 rounded-full shadow-lg">
            <span className="text-[9px] font-bold text-on-primary-fixed uppercase tracking-wider font-mono">重置</span>
          </div>
        )}
      </div>

      {/* Heading */}
      <div className="text-center mb-3 sm:mb-4">
        <h2 className={`font-bold text-white mb-1 font-headline-lg-mobile ${isSmallScreen ? 'text-lg' : 'text-xl'}`}>设置新密码</h2>
        <p className="text-xs text-on-surface-variant">输入从服务器控制台获取的恢复码和新密码</p>
      </div>

      {/* 全局错误 */}
      {error && (
        <div className="w-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
          {error}
        </div>
      )}

      {/* Form Fields */}
      <div className="w-full space-y-2.5 sm:space-y-3">
        {/* Handle */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-handle">
            用户名
          </label>
          <div className="relative">
            <input
              form="reset-form"
              ref={handleRef}
              id="reset-handle"
              type="text"
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              onFocus={() => handleFocusScroll(handleRef.current)}
              placeholder="输入用户名"
              className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2 sm:py-2.5 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
            />
            <span className="font-mono text-sm absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/50">@</span>
          </div>
        </div>

        {/* Recovery Code */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-code">
            恢复码
          </label>
          <input              form="reset-form"
              ref={codeRef}
              id="reset-code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onFocus={() => handleFocusScroll(codeRef.current)}
            placeholder="输入6位恢复码"
            maxLength={6}
            className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2 sm:py-2.5 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md font-mono tracking-widest"
          />
        </div>

        {/* New Password */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-new-password">
            新密码
          </label>
          <div className="relative">
            <input
              form="reset-form"
              ref={passRef}
              id="reset-new-password"
              type={showPass ? 'text' : 'password'}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onFocus={() => handleFocusScroll(passRef.current)}
              placeholder="至少6位字符"
              minLength={6}
              className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2 sm:py-2.5 pr-10 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
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
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1" htmlFor="reset-confirm-password">
            确认新密码
          </label>
          <div className="relative">
            <input
              form="reset-form"
              ref={confirmRef}
              id="reset-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => handleFocusScroll(confirmRef.current)}
              placeholder="再次输入新密码"
              className="w-full bg-surface-elevated/40 border border-outline-variant/50 focus:border-accent-pink rounded-xl px-4 py-2 sm:py-2.5 pr-10 text-white text-sm outline-none transition-all duration-300 backdrop-blur-md"
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
      </div>

      {/* Redirect to login */}
      <p className="text-xs text-on-surface-variant text-center mt-3">
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
