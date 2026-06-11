/**
 * 认证相关自定义 Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserApi } from '../api/users';
import { useToast } from '../components/Toast';

/**
 * 用户登录
 */
export function useLogin() {
  const userApi = useUserApi();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({ handle, password }: { handle: string; password?: string }) => {
      const response = await userApi.login({ handle, password });
      return response;
    },
    onSuccess: (data) => {
      showToast(`欢迎回来，${data.handle}！`, 'success');
    },
    onError: (error: Error) => {
      showToast(`登录失败: ${error.message}`, 'error');
      // 离线模式 fallback
      throw error;
    },
  });
}

/**
 * 用户注册
 */
export function useRegister() {
  const userApi = useUserApi();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async ({
      handle,
      name,
      password,
      email,
    }: {
      handle: string;
      name: string;
      password?: string;
      email?: string;
    }) => {
      await userApi.register({ handle, name, password, email });
      return { handle, name, email };
    },
    onSuccess: () => {
      showToast('注册成功！', 'success');
    },
    onError: (error: Error) => {
      showToast(`注册失败: ${error.message}`, 'error');
      throw error;
    },
  });
}

/**
 * 用户登出
 */
export function useLogout() {
  const userApi = useUserApi();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async () => {
      await userApi.logout();
    },
    onSuccess: () => {
      showToast('已安全退出', 'info');
    },
    onError: () => {
      // 即使 API 失败也清除本地状态
    },
  });
}

/**
 * 获取当前用户信息
 */
export function useCurrentUser() {
  const userApi = useUserApi();

  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: () => userApi.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: false, // 不重试，避免 401 时反复请求
  });
}

/**
 * 修改密码
 */
export function useChangePassword() {
  const userApi = useUserApi();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      showToast('密码修改成功', 'success');
    },
    onError: (error: Error) => {
      showToast(`修改失败: ${error.message}`, 'error');
    },
  });
}

/**
 * 修改头像
 */
export function useChangeAvatar() {
  const userApi = useUserApi();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: userApi.changeAvatar,
    onSuccess: () => {
      // 更新用户缓存
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      showToast('头像更新成功', 'success');
    },
    onError: (error: Error) => {
      showToast(`头像更新失败: ${error.message}`, 'error');
    },
  });
}

/**
 * 修改昵称
 */
export function useChangeName() {
  const userApi = useUserApi();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: userApi.changeName,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      showToast('昵称修改成功', 'success');
    },
    onError: (error: Error) => {
      showToast(`修改失败: ${error.message}`, 'error');
    },
  });
}
