/**
 * Admin API 调用封装
 */

import { api } from './client';
import type {
  UserViewModel,
  CreateUserRequest,
  UserActionRequest,
  AdminCharacterItem,
  AdminWorldItem,
  WorldInfoData,
  UgirlImportResult,
  AdminStats,
  AdminCharacterDetailResponse,
  AdminLlmListResponse,
  AdminLlmTestResult,
  AdminCharacterSource,
} from '../types';

export const adminApi = {
  // 获取用户列表
  getUsers: () =>
    api.post<UserViewModel[]>('/api/users/get'),

  // 创建用户
  createUser: (params: CreateUserRequest) =>
    api.post<{ handle: string }>('/api/users/create', params),

  // 删除用户
  deleteUser: (params: UserActionRequest) =>
    api.post<void>('/api/users/delete', params),

  // 禁用用户
  disableUser: (handle: string) =>
    api.post<void>('/api/users/disable', { handle }),

  // 启用用户
  enableUser: (handle: string) =>
    api.post<void>('/api/users/enable', { handle }),

  // 提升为管理员
  promoteUser: (handle: string) =>
    api.post<void>('/api/users/promote', { handle }),

  // 取消管理员
  demoteUser: (handle: string) =>
    api.post<void>('/api/users/demote', { handle }),

  // 管理员重置密码
  resetPassword: (handle: string, newPassword: string) =>
    api.post<{ ok: boolean }>('/api/users/admin-reset-password', { handle, newPassword }),

  // 获取当前用户信息
  getMe: () =>
    api.get<{ handle: string; name: string; admin: boolean; avatar: string }>('/api/users/me'),

  // 登录
  login: (handle: string, password?: string) =>
    api.post<{ handle: string; admin: boolean }>('/api/users/login', { handle, password }),

  // 登出
  logout: () =>
    api.post<void>('/api/users/logout'),

  // ===== 运营统计 =====
  getStats: () =>
    api.get<AdminStats>('/api/admin/stats'),

  // ===== LLM =====
  getLlms: () =>
    api.get<AdminLlmListResponse>('/api/admin/llm'),

  testLlm: (id: string) =>
    api.post<AdminLlmTestResult>('/api/admin/llm/test', { id }),

  // ===== 评价 =====
  deleteReview: (params: { store: string; characterKey: string; reviewId: string }) =>
    api.del<{ ok: boolean }>('/api/admin/reviews', params),

  // ===== 角色管理（Admin） =====

  getAllCharacters: (handle?: string) =>
    api.post<AdminCharacterItem[]>('/api/characters/admin-all', handle ? { handle } : {}),

  getCharacterDetail: (params: {
    source: AdminCharacterSource;
    handle?: string;
    characterId?: string;
    avatar_url?: string;
  }) =>
    api.post<AdminCharacterDetailResponse>('/api/characters/admin-get', params),

  adminDeleteCharacter: (handle: string, avatar_url: string) =>
    api.post<void>('/api/characters/admin-delete', { handle, avatar_url }),

  adminEditCharacter: (params: {
    handle: string;
    avatar_url?: string;
    characterId?: string;
    source?: AdminCharacterSource;
    name?: string;
    tags?: string[];
    description?: string;
  }) =>
    api.post<void>('/api/characters/admin-edit', params),

  adminSetPrivacy: (params: {
    handle: string;
    characterId: string;
    privacyType: 'public' | 'private';
    source?: string;
  }) =>
    api.post<{ ok: boolean }>('/api/characters/admin-set-privacy', params),

  adminDeletePublished: (handle: string, characterId: string) =>
    api.post<void>('/api/characters/admin-delete-published', { handle, characterId }),

  // ===== 世界书管理（Admin） =====

  getAllWorlds: () =>
    api.post<AdminWorldItem[]>('/api/worlds/admin-list', {}),

  adminGetWorld: (name: string) =>
    api.post<WorldInfoData>('/api/worlds/admin-get', { name }),

  adminSaveWorld: (name: string, data: WorldInfoData) =>
    api.post<void>('/api/worlds/admin-save', { name, data }),

  adminDeleteWorld: (name: string) =>
    api.post<void>('/api/worlds/admin-delete', { name }),

  adminImportWorld: (file: File) =>
    api.upload<{ ok: boolean; name: string }>('/api/worlds/admin-import', file),

  // ===== ugirl 批量导入 =====

  adminImportUgirl: (filePath: string, handle: string) =>
    api.post<UgirlImportResult>('/api/characters/admin-import-ugirl', {
      file_path: filePath,
      handle,
    }),
};
