import { useState } from 'react';
import {
  useUsers,
  useCreateUser,
  useDeleteUser,
  useToggleUserStatus,
  useToggleAdmin,
} from '../hooks/useAdminApi';
import type { CreateUserRequest, UserViewModel } from '../types';
import {
  Search,
  Plus,
  Shield,
  ShieldOff,
  UserCheck,
  UserX,
  Trash2,
  X,
  Check,
} from 'lucide-react';

export default function Users() {
  const { data: users, isLoading, error } = useUsers();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = users?.filter(
    (u) =>
      u.handle.toLowerCase().includes(search.toLowerCase()) ||
      u.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white font-mono tracking-wider">用户管理</h1>
          <p className="text-xs text-on-surface-variant mt-1">
            {users ? `共 ${users.length} 个用户` : '加载中...'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          创建用户
        </button>
      </div>

      {/* 搜索 */}
      <div className="relative max-w-xs">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索用户..."
          className="w-full bg-surface-container border border-outline-variant/30 rounded-xl py-2 pl-10 pr-4 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-xs text-red-400">
          加载失败：{(error as Error).message}
        </div>
      )}

      {/* 用户表格 */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-surface-container/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-surface-container/30 border border-outline-variant/20 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-outline-variant/20 text-on-surface-variant font-mono">
                  <th className="text-left px-5 py-3 font-semibold">用户</th>
                  <th className="text-left px-5 py-3 font-semibold">名称</th>
                  <th className="text-center px-5 py-3 font-semibold">管理员</th>
                  <th className="text-center px-5 py-3 font-semibold">状态</th>
                  <th className="text-center px-5 py-3 font-semibold">密码</th>
                  <th className="text-center px-5 py-3 font-semibold">注册时间</th>
                  <th className="text-right px-5 py-3 font-semibold">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-on-surface-variant">
                      没有找到匹配的用户
                    </td>
                  </tr>
                ) : (
                  filtered?.map((user) => <UserRow key={user.handle} user={user} />)
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 创建用户弹窗 */}
      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function UserRow({ user }: { user: UserViewModel }) {
  const toggleStatus = useToggleUserStatus();
  const toggleAdmin = useToggleAdmin();
  const deleteUser = useDeleteUser();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isDefaultUser = user.handle === 'default-user';
  const date = new Date(user.created).toLocaleDateString('zh-CN');

  return (
    <tr className="border-b border-outline-variant/10 hover:bg-surface-container/50 transition-colors">
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-accent-pink/15 flex items-center justify-center text-[10px] font-bold text-accent-pink font-mono">
            {user.handle[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-white font-medium font-mono">{user.handle}</span>
        </div>
      </td>
      <td className="px-5 py-3.5 text-on-surface-variant">{user.name || '-'}</td>
      <td className="px-5 py-3.5 text-center">
        {user.admin ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-purple/10 border border-accent-purple/30 rounded-full text-[10px] text-accent-purple">
            <Shield className="w-3 h-3" /> Admin
          </span>
        ) : (
          <span className="text-on-surface-variant/50">-</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-center">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
            user.enabled !== false
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}
        >
          {user.enabled !== false ? '启用' : '禁用'}
        </span>
      </td>
      <td className="px-5 py-3.5 text-center">
        {user.password ? (
          <span className="text-on-surface-variant/50">✓</span>
        ) : (
          <span className="text-yellow-400/60 font-mono text-[10px]">无密码</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-center text-on-surface-variant/60 font-mono text-[10px]">
        {date}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1.5">
          {/* 启用/禁用 */}
          {user.enabled !== false ? (
            <button
              onClick={() => toggleStatus.mutate({ handle: user.handle, enabled: false })}
              disabled={isDefaultUser || toggleStatus.isPending}
              title="禁用"
              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-30 cursor-pointer transition-colors"
            >
              <UserX className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => toggleStatus.mutate({ handle: user.handle, enabled: true })}
              disabled={toggleStatus.isPending}
              title="启用"
              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-green-400 hover:bg-green-500/10 cursor-pointer transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 提升/降级管理员 */}
          {user.admin ? (
            <button
              onClick={() => toggleAdmin.mutate({ handle: user.handle, makeAdmin: false })}
              disabled={isDefaultUser || toggleAdmin.isPending}
              title="取消管理员"
              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-accent-pink hover:bg-accent-pink/10 disabled:opacity-30 cursor-pointer transition-colors"
            >
              <ShieldOff className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => toggleAdmin.mutate({ handle: user.handle, makeAdmin: true })}
              disabled={toggleAdmin.isPending}
              title="提升为管理员"
              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-accent-purple hover:bg-accent-purple/10 cursor-pointer transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 删除 */}
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  deleteUser.mutate({ handle: user.handle });
                  setConfirmDelete(false);
                }}
                disabled={isDefaultUser || deleteUser.isPending}
                className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer"
                title="确认删除"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:text-white cursor-pointer"
                title="取消"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={isDefaultUser}
              title={isDefaultUser ? '无法删除默认用户' : '删除'}
              className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-30 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const createUser = useCreateUser();
  const [form, setForm] = useState<CreateUserRequest & { confirmPassword: string }>({
    handle: '',
    name: '',
    password: '',
    admin: false,
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');

    if (!form.handle.trim()) {
      setError('用户名不能为空');
      return;
    }
    if (form.password && form.password !== form.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    try {
      await createUser.mutateAsync({
        handle: form.handle.trim(),
        name: (form.name || '').trim() || undefined,
        password: form.password || undefined,
        admin: form.admin,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface border border-outline-variant/20 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/20">
          <h2 className="text-sm font-bold text-white font-mono">创建用户</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <InputField
            label="用户名 *"
            value={form.handle}
            onChange={(v) => setForm({ ...form, handle: v })}
            placeholder="字母、数字、下划线"
          />
          <InputField
            label="显示名称"
            value={form.name || ''}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="可选"
          />
          <InputField
            label="密码"
            type="password"
            value={form.password || ''}
            onChange={(v) => setForm({ ...form, password: v })}
            placeholder="留空则无密码登录"
          />
          <InputField
            label="确认密码"
            type="password"
            value={form.confirmPassword}
            onChange={(v) => setForm({ ...form, confirmPassword: v })}
            placeholder="再次输入密码"
          />

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={form.admin}
              onChange={(e) => setForm({ ...form, admin: e.target.checked })}
              className="w-4 h-4 accent-accent-pink"
            />
            <span className="text-xs text-on-surface-variant">设为管理员</span>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2.5 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-elevated border border-outline-variant/30 text-xs text-on-surface-variant rounded-xl hover:text-white transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={createUser.isPending}
              className="flex-1 py-2.5 bg-gradient-to-r from-accent-pink to-accent-purple text-white text-xs font-bold rounded-xl hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {createUser.isPending ? '创建中...' : '创建'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-on-surface-variant ml-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-surface-container border border-outline-variant/30 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-on-surface-variant/30 outline-none focus:border-accent-pink transition-colors"
      />
    </div>
  );
}
