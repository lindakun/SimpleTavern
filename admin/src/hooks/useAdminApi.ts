/**
 * Admin API React Query hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin';
import type { CreateUserRequest, WorldInfoData } from '../types';

export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  me: () => [...adminKeys.all, 'me'] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
};

// 获取用户列表
export function useUsers() {
  return useQuery({
    queryKey: adminKeys.users(),
    queryFn: adminApi.getUsers,
    staleTime: 30_000,
  });
}

// 获取当前用户
export function useCurrentUser() {
  return useQuery({
    queryKey: adminKeys.me(),
    queryFn: adminApi.getMe,
    retry: false,
    staleTime: 60_000,
  });
}

// 创建用户
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateUserRequest) => adminApi.createUser(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

// 删除用户
export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { handle: string; purge?: boolean }) =>
    adminApi.deleteUser(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

// 切换用户状态（禁用/启用）
export function useToggleUserStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, enabled }: { handle: string; enabled: boolean }) =>
      enabled ? adminApi.enableUser(handle) : adminApi.disableUser(handle),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

// 切换管理员状态（提升/降级）
export function useToggleAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, makeAdmin }: { handle: string; makeAdmin: boolean }) =>
      makeAdmin ? adminApi.promoteUser(handle) : adminApi.demoteUser(handle),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminKeys.users() }),
  });
}

// 登录
export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, password }: { handle: string; password?: string }) =>
      adminApi.login(handle, password),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.me() });
    },
  });
}

// 登出
export function useAdminLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: adminApi.logout,
    onSuccess: () => {
      qc.clear();
    },
  });
}

// ===== 角色管理 Hooks =====

export const characterKeys = {
  all: ['admin', 'characters'] as const,
  list: (handle?: string) => [...characterKeys.all, handle ?? '__all__'] as const,
};

// 获取所有角色
export function useAllCharacters(handle?: string) {
  return useQuery({
    queryKey: characterKeys.list(handle),
    queryFn: () => adminApi.getAllCharacters(handle),
    staleTime: 15_000,
  });
}

// 删除角色（管理员）
export function useAdminDeleteCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, avatar_url }: { handle: string; avatar_url: string }) =>
      adminApi.adminDeleteCharacter(handle, avatar_url),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all }),
  });
}

// 删除发布角色（管理员）
export function useAdminDeletePublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ handle, characterId }: { handle: string; characterId: string }) =>
      adminApi.adminDeletePublished(handle, characterId),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all }),
  });
}

// 编辑角色（管理员）
export function useAdminEditCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { handle: string; avatar_url: string; name?: string; tags?: string[] }) =>
      adminApi.adminEditCharacter(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: characterKeys.all }),
  });
}

// ===== ugirl 批量导入 Hook =====

// 批量导入 ugirl 角色
export function useAdminImportUgirl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ filePath, handle }: { filePath: string; handle: string }) =>
      adminApi.adminImportUgirl(filePath, handle),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: characterKeys.all });
    },
  });
}

// ===== 世界书管理 Hooks =====

export const worldKeys = {
  all: ['admin', 'worlds'] as const,
  detail: (name: string) => [...worldKeys.all, name] as const,
};

// 获取所有世界书列表
export function useAllWorlds() {
  return useQuery({
    queryKey: worldKeys.all,
    queryFn: adminApi.getAllWorlds,
    staleTime: 15_000,
  });
}

// 获取指定世界书内容
export function useAdminGetWorld(name: string | null) {
  return useQuery({
    queryKey: worldKeys.detail(name ?? ''),
    queryFn: () => adminApi.adminGetWorld(name!),
    enabled: !!name,
  });
}

// 保存世界书（创建或更新）
export function useAdminSaveWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, data }: { name: string; data: WorldInfoData }) =>
      adminApi.adminSaveWorld(name, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: worldKeys.all }),
  });
}

// 删除世界书
export function useAdminDeleteWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => adminApi.adminDeleteWorld(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: worldKeys.all }),
  });
}

// 导入世界书（上传 JSON 文件）
export function useAdminImportWorld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminApi.adminImportWorld(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: worldKeys.all }),
  });
}
