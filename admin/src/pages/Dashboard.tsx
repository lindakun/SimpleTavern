import { useNavigate } from 'react-router-dom';
import { useUsers } from '../hooks/useAdminApi';
import { Users, Shield, Activity, UserCheck } from 'lucide-react';

export default function Dashboard() {
  const { data: users, isLoading, error } = useUsers();

  const stats = users
    ? {
        totalUsers: users.length,
        adminCount: users.filter((u) => u.admin).length,
        enabledCount: users.filter((u) => u.enabled !== false).length,
        noPassword: users.filter((u) => !u.password).length,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-wider">仪表盘</h1>
        <p className="text-xs text-on-surface-variant mt-1">系统运行概览</p>
      </div>

      {/* 装饰性光晕 */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-accent-pink opacity-5 blur-[120px] pointer-events-none" />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="总用户数"
          value={stats?.totalUsers ?? '-'}
          color="accent-pink"
          loading={isLoading}
        />
        <StatCard
          icon={Shield}
          label="管理员"
          value={stats?.adminCount ?? '-'}
          color="accent-purple"
          loading={isLoading}
        />
        <StatCard
          icon={UserCheck}
          label="启用用户"
          value={stats ? `${stats.enabledCount}/${stats.totalUsers}` : '-'}
          color="green"
          loading={isLoading}
        />
        <StatCard
          icon={Activity}
          label="无密码用户"
          value={stats?.noPassword ?? '-'}
          color="yellow"
          loading={isLoading}
        />
      </div>

      {/* 快速入口 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <QuickLink
          title="用户管理"
          desc="查看、创建、编辑、删除用户"
          path="/users"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
  loading?: boolean;
}) {
  const colorMap: Record<string, string> = {
    'accent-pink': 'bg-accent-pink/10 border-accent-pink/30 text-accent-pink',
    'accent-purple': 'bg-accent-purple/10 border-accent-purple/30 text-accent-purple',
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  };

  return (
    <div className="bg-surface-container/50 border border-outline-variant/20 rounded-2xl p-5 space-y-3">
      <div className={`inline-flex p-2.5 rounded-xl border ${colorMap[color] || colorMap['accent-pink']}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[11px] text-on-surface-variant font-mono">{label}</p>
        <p className="text-xl font-bold text-white font-mono mt-1">
          {loading ? (
            <span className="inline-block w-12 h-5 bg-surface-elevated rounded animate-pulse" />
          ) : (
            value
          )}
        </p>
      </div>
    </div>
  );
}

function QuickLink({ title, desc, path }: { title: string; desc: string; path: string }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(path)}
      className="text-left bg-surface-container/50 border border-outline-variant/20 hover:border-accent-pink/40 rounded-2xl p-5 transition-all cursor-pointer group"
    >
      <h3 className="text-sm font-bold text-white group-hover:text-accent-pink transition-colors">{title}</h3>
      <p className="text-xs text-on-surface-variant mt-1">{desc}</p>
    </button>
  );
}
