import { useState, useMemo } from 'react';
import { ScreenId } from '../types';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';
import { HandleSchema, EmailSchema, PasswordSchema } from '../validations/auth';

interface RegisterScreenProps {
  onNavigate: (screen: ScreenId) => void;
  onRegister: (username: string, email: string, password?: string) => Promise<void>;
  onGoogleLogin?: (idToken: string) => void;
}

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterScreen({ onNavigate, onRegister }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // 实时验证（仅在字段被 touched 后显示）
  const fieldErrors = useMemo<FieldErrors>(() => {
    const errors: FieldErrors = {};
    if (touched.username) {
      const result = HandleSchema.safeParse(username);
      if (!result.success) errors.username = result.error.issues[0].message;
    }
    if (touched.email) {
      const result = EmailSchema.safeParse(email);
      if (!result.success) errors.email = result.error.issues[0].message;
    }
    if (touched.password) {
      const result = PasswordSchema.safeParse(password);
      if (!result.success) errors.password = result.error.issues[0].message;
    }
    if (touched.confirmPassword) {
      if (!confirmPassword) errors.confirmPassword = '请确认密码';
      else if (password !== confirmPassword) errors.confirmPassword = '两次输入的密码不一致';
    }
    return errors;
  }, [username, email, password, confirmPassword, touched]);

  const markTouched = (field: string) => {
    setTouched(prev => prev[field] ? prev : { ...prev, [field]: true });
  };

  const canSubmit = useMemo(() => {
    return (
      username.trim() !== '' &&
      email.trim() !== '' &&
      password.trim() !== '' &&
      confirmPassword.trim() !== '' &&
      Object.values(fieldErrors).every(e => !e)
    );
  }, [username, email, password, confirmPassword, fieldErrors]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    // 标记所有字段为 touched
    setTouched({ username: true, email: true, password: true, confirmPassword: true });
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await onRegister(username, email, password);
      onNavigate(ScreenId.EMAIL_LOGIN);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注册失败，请重试';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
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
          {/* 全局错误 */}
          {submitError && (
            <div className="bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
              {submitError}
            </div>
          )}

          {/* 用户名 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">用户名</label>
            <div className="relative">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onBlur={() => markTouched('username')}
                placeholder="3-30位英文、数字或下划线"
                className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2.5 text-white text-xs outline-none transition-colors ${
                  touched.username && fieldErrors.username
                    ? 'border-red-500/60 focus:border-red-400'
                    : touched.username && username
                      ? 'border-green-500/40 focus:border-green-400'
                      : 'border-outline-variant/50 focus:border-accent-pink'
                }`}
              />
            </div>
            {touched.username && fieldErrors.username && (
              <p className="text-[10px] text-red-400 ml-1">{fieldErrors.username}</p>
            )}
          </div>

          {/* 邮箱 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">电子邮箱</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched('email')}
                placeholder="example@yuzu.ai"
                className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2.5 text-white text-xs outline-none transition-colors ${
                  touched.email && fieldErrors.email
                    ? 'border-red-500/60 focus:border-red-400'
                    : touched.email && email
                      ? 'border-green-500/40 focus:border-green-400'
                      : 'border-outline-variant/50 focus:border-accent-pink'
                }`}
              />
            </div>
            {touched.email && fieldErrors.email && (
              <p className="text-[10px] text-red-400 ml-1">{fieldErrors.email}</p>
            )}
          </div>

          {/* 密码 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">密码</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => markTouched('password')}
                placeholder="至少6位，含大小写字母和数字"
                className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2.5 pr-10 text-white text-xs outline-none transition-colors ${
                  touched.password && fieldErrors.password
                    ? 'border-red-500/60 focus:border-red-400'
                    : touched.password && password
                      ? 'border-green-500/40 focus:border-green-400'
                      : 'border-outline-variant/50 focus:border-accent-pink'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
              >
                {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {touched.password && fieldErrors.password && (
              <p className="text-[10px] text-red-400 ml-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* 确认密码 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">确认密码</label>
            <div className="relative">
              <input
                type={showConfirmPass ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => markTouched('confirmPassword')}
                placeholder="再次输入密码"
                className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2.5 pr-10 text-white text-xs outline-none transition-colors ${
                  touched.confirmPassword && fieldErrors.confirmPassword
                    ? 'border-red-500/60 focus:border-red-400'
                    : touched.confirmPassword && confirmPassword && !fieldErrors.confirmPassword
                      ? 'border-green-500/40 focus:border-green-400'
                      : 'border-outline-variant/50 focus:border-accent-pink'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPass(!showConfirmPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
              >
                {showConfirmPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {touched.confirmPassword && fieldErrors.confirmPassword && (
              <p className="text-[10px] text-red-400 ml-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl text-xs font-bold shadow-[0_4px_20px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '注册中...' : '注册'}
          </button>
        </form>

        {/* Existing user trigger -> login view */}
        <p className="text-xs text-on-surface-variant text-center mt-6">
          已有账号？{' '}
          <button
            onClick={() => onNavigate(ScreenId.EMAIL_LOGIN)}
            className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
          >
            立即登录
          </button>
        </p>

        <p className="text-[10px] text-on-surface-variant/40 text-center mt-8">
          注册即代表您同意我们的 <br />
          <a href="#terms" className="underline hover:text-accent-pink">服务条款</a> 与 <a href="#privacy" className="underline hover:text-accent-pink">隐私政策</a>
        </p>
      </main>
    </div>
  );
}
