import { useState, type FormEvent } from 'react';
import { adminApi } from '../api/admin';
import { ShieldAlert, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [handle, setHandle] = useState('default-user');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await adminApi.login(handle, password || undefined);
      if (!res.admin) {
        setError('该用户不是管理员，无权限访问');
        setLoading(false);
        return;
      }
      onLoginSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '登录失败';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-deep flex items-center justify-center p-6">
      {/* 背景光晕 */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-accent-pink opacity-5 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent-purple opacity-5 blur-[150px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm">
        {/* 头部 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-pink/10 border border-accent-pink/30 mb-4">
            <ShieldAlert className="w-8 h-8 text-accent-pink" />
          </div>
          <h1 className="text-xl font-bold text-white font-mono tracking-widest">
            ADMIN PANEL
          </h1>
          <p className="text-xs text-on-surface-variant mt-2 font-mono">
            SimpleTavern 管理控制台
          </p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">用户名</label>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
              placeholder="输入用户名"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant ml-1">密码</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-3 pr-10 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
                placeholder="密码（可选）"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-white cursor-pointer"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-400 animate-subtle-fadeIn">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
          >
            {loading ? '验证中...' : '登录管理面板'}
          </button>
        </form>

        <p className="text-[10px] text-on-surface-variant/40 text-center mt-6 font-mono">
          SIMPLETAVERN ADMIN v0.1
        </p>
      </div>
    </div>
  );
}
