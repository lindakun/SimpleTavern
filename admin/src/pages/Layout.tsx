import { type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, LogOut, Shield, UserCircle, BookOpen } from 'lucide-react';
import { adminApi } from '../api/admin';

interface LayoutProps {
  children: ReactNode;
  handle: string;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { path: '/', label: '仪表盘', icon: LayoutDashboard },
  { path: '/users', label: '用户管理', icon: Users },
  { path: '/characters', label: '角色管理', icon: UserCircle },
  { path: '/worlds', label: '世界书管理', icon: BookOpen },
];

export default function Layout({ children, handle, onLogout }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await adminApi.logout().catch(() => {});
    onLogout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background-deep text-on-surface flex">
      {/* 侧边栏 */}
      <aside className="w-56 bg-surface border-r border-outline-variant/20 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-5 border-b border-outline-variant/20">
          <Shield className="w-5 h-5 text-accent-pink" />
          <span className="font-mono font-bold text-sm tracking-wider text-white">
            ADMIN
          </span>
        </div>

        {/* 导航 */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-accent-pink/10 text-accent-pink border border-accent-pink/30'
                    : 'text-on-surface-variant hover:text-white hover:bg-surface-container border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="p-4 border-t border-outline-variant/20">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 rounded-full bg-accent-pink/20 flex items-center justify-center text-xs font-bold text-accent-pink font-mono">
              {handle[0]?.toUpperCase() || 'A'}
            </div>
            <div className="text-[11px]">
              <p className="text-white font-medium truncate max-w-[120px]">{handle}</p>
              <p className="text-on-surface-variant/60">管理员</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-red-500/30 text-red-400 text-[11px] hover:bg-red-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-6xl mx-auto animate-subtle-fadeIn">
          {children}
        </div>
      </main>
    </div>
  );
}
