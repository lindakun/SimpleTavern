/**
 * Admin API 调用封装
 */

import { api } from './client';
import type { UserViewModel, CreateUserRequest, UserActionRequest, AdminCharacterItem, AdminWorldItem, WorldInfoData } from '../types';

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

  // 获取当前用户信息
  getMe: () =>
    api.get<{ handle: string; name: string; admin: boolean; avatar: string }>('/api/users/me'),

  // 登录
  login: (handle: string, password?: string) =>
    api.post<{ handle: string; admin: boolean }>('/api/users/login', { handle, password }),

  // 登出
  logout: () =>
    api.post<void>('/api/users/logout'),

  // 获取角色总数
  getCharactersCount: () =>
    api.post<unknown[]>('/api/characters/all', {}),

  // ===== 角色管理（Admin） =====

  // 获取所有用户的所有角色
  getAllCharacters: (handle?: string) =>
    api.post<AdminCharacterItem[]>('/api/characters/admin-all', handle ? { handle } : {}),

  // 删除指定用户的角色
  adminDeleteCharacter: (handle: string, avatar_url: string) =>
    api.post<void>('/api/characters/admin-delete', { handle, avatar_url }),

  // 编辑指定用户的角色
  adminEditCharacter: (params: { handle: string; avatar_url: string; name?: string; tags?: string[] }) =>
    api.post<void>('/api/characters/admin-edit', params),

  // 删除指定用户的发布角色
  adminDeletePublished: (handle: string, characterId: string) =>
    api.post<void>('/api/characters/admin-delete-published', { handle, characterId }),

  // ===== 世界书管理（Admin） =====

  // 获取所有世界书
  getAllWorlds: () =>
    api.post<AdminWorldItem[]>('/api/worlds/admin-list', {}),

  // 获取指定世界书内容
  adminGetWorld: (name: string) =>
    api.post<WorldInfoData>('/api/worlds/admin-get', { name }),

  // 创建或保存世界书
  adminSaveWorld: (name: string, data: WorldInfoData) =>
    api.post<void>('/api/worlds/admin-save', { name, data }),

  // 删除世界书
  adminDeleteWorld: (name: string) =>
    api.post<void>('/api/worlds/admin-delete', { name }),

  // 导入世界书（上传 .json 文件）
  adminImportWorld: (file: File) =>
    api.upload<{ ok: boolean; name: string }>('/api/worlds/admin-import', file),
};
