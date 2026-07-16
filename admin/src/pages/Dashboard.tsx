import { useNavigate } from 'react-router-dom';
import { useAdminStats, useUsers } from '../hooks/useAdminApi';
import {
  Users,
  Shield,
  UserCheck,
  UserPlus,
  BookUser,
  MessageSquare,
  FileImage,
  Globe,
  Clock,
} from 'lucide-react';

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading, error } = useAdminStats();
  const { data: users } = useUsers();

  const recentUsers = (users || [])
    .slice()
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .slice(0, 5);

  const totalChars = stats
    ? stats.characters.seed +
      stats.characters.publishedPublic +
      stats.characters.publishedPrivate +
      stats.characters.filePng
    : null;

  return (
    <div className="space-y-6 relative">
      <div>
        <h1 className="text-lg font-bold text-white font-mono tracking-wider">仪表盘</h1>
        <p className="text-xs text-on-surface-variant mt-1">系统运行概览</p>
      </div>

      <div className="absolute top-0 right-0 w-72 h-72 bg-accent-pink opacity-5 blur-[120px] pointer-events-none" />

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="总用户" value={stats?.users.total ?? '-'} color="accent-pink" loading={isLoading} />
        <StatCard icon={Shield} label="管理员" value={stats?.users.admins ?? '-'} color="accent-purple" loading={isLoading} />
        <StatCard
          icon={UserCheck}
          label="启用用户"
          value={stats ? `${stats.users.enabled}/${stats.users.total}` : '-'}
          color="green"
          loading={isLoading}
        />
        <StatCard icon={UserPlus} label="近 7 日注册" value={stats?.users.createdLast7d ?? '-'} color="yellow" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookUser} label="角色总数" value={totalChars ?? '-'} color="accent-pink" loading={isLoading} />
        <StatCard icon={Globe} label="公开发布" value={stats?.characters.publishedPublic ?? '-'} color="green" loading={isLoading} />
        <StatCard icon={FileImage} label="PNG 文件角色" value={stats?.characters.filePng ?? '-'} color="accent-purple" loading={isLoading} />
        <StatCard icon={MessageSquare} label="聊天文件" value={stats?.chats.fileCount ?? '-'} color="yellow" loading={isLoading} />
      </div>

      {stats && (
        <div className="bg-surface-container/40 border border-outline-variant/20 rounded-2xl px-5 py-4 flex flex-wrap gap-6 text-[11px] text-on-surface-variant font-mono">
          <span>版本 {stats.system.version}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> 运行 {formatUptime(stats.system.uptimeSec)}
          </span>
          <span className="truncate max-w-full" title={stats.system.dataRoot}>
            dataRoot: {stats.system.dataRoot}
          </span>
          <span>
            种子 {stats.characters.seed} · 私有发布 {stats.characters.publishedPrivate}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickLink title="用户管理" desc="创建、禁用、重置密码、提权" path="/users" />
        <QuickLink title="角色管理" desc="审核下架、详情、评价治理" path="/characters" />
        <QuickLink title="模型配置" desc="查看 Provider 并测试连通" path="/llm" />
      </div>

      <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant/20 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white font-mono">最近注册</h2>
          <button
            onClick={() => navigate('/users')}
            className="text-[11px] text-accent-pink hover:underline cursor-pointer"
          >
            查看全部
          </button>
        </div>
        <div className="divide-y divide-outline-variant/10">
          {recentUsers.length === 0 ? (
            <p className="px-5 py-8 text-center text-xs text-on-surface-variant">暂无用户数据</p>
          ) : (
            recentUsers.map((u) => (
              <div key={u.handle} className="px-5 py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-accent-pink/15 flex items-center justify-center text-[10px] font-bold text-accent-pink font-mono">
                    {u.handle[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-mono">{u.handle}</p>
                    <p className="text-[10px] text-on-surface-variant">{u.name || '-'}</p>
                  </div>
                </div>
                <span className="text-[10px] text-on-surface-variant font-mono">
                  {new Date(u.created).toLocaleDateString('zh-CN')}
                </span>
              </div>
            ))
          )}
        </div>
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
