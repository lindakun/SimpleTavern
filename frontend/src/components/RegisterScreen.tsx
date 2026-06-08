import { useState, useMemo, useRef, useCallback } from 'react';
import { ScreenId } from '../types';
import { Eye, EyeOff } from 'lucide-react';
import { HandleSchema, EmailSchema, PasswordSchema } from '../validations/auth';
import AuthLayout from './AuthLayout';

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

  // Refs for keyboard scroll
  const usernameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const handleFocusScroll = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 350);
  }, []);

  const isSmallScreen = typeof window !== 'undefined' && window.innerHeight < 700;

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
    setTouched({ username: true, email: true, password: true, confirmPassword: true });
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError('');
    try {
      await onRegister(username, email, password);
      onNavigate(ScreenId.DISCOVER);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '注册失败，请重试';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <form id="register-form" onSubmit={handleRegister} className="w-full">
      <button
        type="submit"
        disabled={submitting || !canSubmit}
        className="w-full bg-gradient-to-r from-accent-pink to-accent-purple text-white py-3 rounded-xl text-sm font-bold shadow-[0_4px_20px_rgba(232,121,199,0.3)] hover:brightness-110 active:scale-95 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? '注册中...' : '注册'}
      </button>
    </form>
  );

  return (
    <AuthLayout title="注册账号" onBack={() => onNavigate(ScreenId.WELCOME)} footer={footer}>
      {/* Avatar - 响应式缩小 */}
      <div className={`relative mb-2 sm:mb-3 rounded-full overflow-hidden border-2 border-accent-pink/50 shadow-[0_0_20px_rgba(232,121,199,0.3)] ${isSmallScreen ? 'w-20 h-20' : 'w-24 h-24'}`}>
        <img
          alt="Join Header Portrait"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          src="/yuzuai_logo.png"
        />
      </div>

      {/* Heading */}
      <div className="text-center mb-3 sm:mb-4">
        <h2 className={`font-bold text-white mb-1 font-headline-lg-mobile ${isSmallScreen ? 'text-lg' : 'text-xl'}`}>加入霓虹秘境</h2>
        <p className="text-xs text-on-surface-variant">立即开启您的柚姬AI之旅</p>
      </div>

      {/* 全局错误 */}
      {submitError && (
        <div className="w-full bg-red-600/20 border border-red-500/40 text-red-300 text-xs px-4 py-2.5 rounded-xl">
          {submitError}
        </div>
      )}

      {/* Form Fields */}
      <div className="w-full space-y-2.5 sm:space-y-3">
        {/* 用户名 */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1">用户名</label>
          <div className="relative">
            <input
              form="register-form"
              ref={usernameRef}
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => markTouched('username')}
              onFocus={() => handleFocusScroll(usernameRef.current)}
              placeholder="3-30位英文、数字或下划线"
              className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2 sm:py-2.5 text-white text-xs outline-none transition-colors ${
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
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1">电子邮箱</label>
          <div className="relative">
            <input
              form="register-form"
              ref={emailRef}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              onFocus={() => handleFocusScroll(emailRef.current)}
              placeholder="example@yuzu.ai"
              className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2 sm:py-2.5 text-white text-xs outline-none transition-colors ${
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
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1">密码</label>
          <div className="relative">
            <input
              form="register-form"
              ref={passwordRef}
              type={showPass ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => markTouched('password')}
              onFocus={() => handleFocusScroll(passwordRef.current)}
              placeholder="至少6位，含大小写字母和数字"
              className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2 sm:py-2.5 pr-10 text-white text-xs outline-none transition-colors ${
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
        <div className="space-y-1">
          <label className="text-xs font-semibold text-on-surface-variant ml-1">确认密码</label>
          <div className="relative">
            <input
              form="register-form"
              ref={confirmRef}
              type={showConfirmPass ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => markTouched('confirmPassword')}
              onFocus={() => handleFocusScroll(confirmRef.current)}
              placeholder="再次输入密码"
              className={`w-full bg-surface-elevated/40 border rounded-xl px-4 py-2 sm:py-2.5 pr-10 text-white text-xs outline-none transition-colors ${
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
      </div>

      {/* Existing user trigger */}
      <p className="text-xs text-on-surface-variant text-center mt-2">
        已有账号？{' '}
        <button
          onClick={() => onNavigate(ScreenId.LOGIN)}
          className="text-accent-pink font-bold hover:underline ml-1 cursor-pointer"
        >
          立即登录
        </button>
      </p>

      <p className="text-[10px] text-on-surface-variant/40 text-center mt-2">
        注册即代表您同意我们的 <br />
        <a href="#terms" className="underline hover:text-accent-pink">服务条款</a> 与 <a href="#privacy" className="underline hover:text-accent-pink">隐私政策</a>
      </p>
    </AuthLayout>
  );
}
