/**
 * 用户相关 API
 */

import { useApiClient } from './client';

interface LoginParams {
  handle: string;
  password?: string;
}

interface LoginResponse {
  handle: string;
  name?: string;
  admin?: boolean;
}

interface RegisterParams {
  handle: string;
  name: string;
  password?: string;
  email?: string;
}

interface UserProfile {
  handle: string;
  name: string;
  created: number;
  avatar: string;
  admin: boolean;
}

interface ChangePasswordParams {
  handle: string;
  oldPassword: string;
  newPassword: string;
}

interface ChangeAvatarParams {
  handle: string;
  avatar: string;
}

interface ChangeNameParams {
  handle: string;
  name: string;
}

export function useUserApi() {
  const { get, post, delete: del } = useApiClient();

  return {
    // 登录
    login: (params: LoginParams) =>
      post<LoginResponse>('/api/users/login', params),

    // 注册
    register: (params: RegisterParams) =>
      post('/api/users/register', params),

    // Google 登录
    googleLogin: (idToken: string) =>
      post<{ handle: string }>('/api/users/google-login', { idToken }),

    // 登出
    logout: () =>
      post('/api/users/logout'),

    // 获取用户列表
    getUsers: () =>
      get<Array<{ handle: string; name: string }>>('/api/users/list'),

    // 获取当前用户信息
    getMe: () =>
      get<UserProfile>('/api/users/me', { showError: false }),

    // 修改密码
    changePassword: (params: ChangePasswordParams) =>
      post('/api/users/change-password', params),

    // 修改头像
    changeAvatar: (params: ChangeAvatarParams) =>
      post('/api/users/change-avatar', params),

    // 修改昵称
    changeName: (params: ChangeNameParams) =>
      post('/api/users/change-name', params),

    // 获取收藏列表
    getFavorites: () =>
      get<{ favorites: string[] }>('/api/users/favorites'),

    // 添加收藏
    addFavorite: (characterId: string) =>
      post('/api/users/favorites', { characterId }),

    // 删除收藏
    removeFavorite: (characterId: string) =>
      del<{ favorites: string[] }>(`/api/users/favorites/${characterId}`),

    // 获取用户设置
    getSettings: () =>
      get<{ settings: Record<string, unknown> }>('/api/users/settings'),

    // 保存用户设置
    saveSettings: (settings: Record<string, unknown>) =>
      post('/api/users/settings', { settings }),

    // 密码恢复（Step1: 发送恢复码到控制台）
    recoverPassword: (handle: string) =>
      post('/api/users/recover-step1', { handle }),

    // 重置密码（Step2: 使用恢复码重置密码）
    resetPassword: (handle: string, code: string, newPassword: string) =>
      post('/api/users/recover-step2', { handle, code, newPassword }),

    // 管理员接口 - 创建用户
    createUser: (params: RegisterParams) =>
      post('/api/users/create', params),

    // 管理员接口 - 删除用户
    deleteUser: (handle: string) =>
      post('/api/users/delete', { handle }),

    // 管理员接口 - 禁用用户
    disableUser: (handle: string) =>
      post('/api/users/disable', { handle }),

    // 管理员接口 - 启用用户
    enableUser: (handle: string) =>
      post('/api/users/enable', { handle }),

    // 管理员接口 - 提升为管理员
    promoteUser: (handle: string) =>
      post('/api/users/promote', { handle }),

    // 管理员接口 - 取消管理员
    demoteUser: (handle: string) =>
      post('/api/users/demote', { handle }),
  };
}
