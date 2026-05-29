/**
 * 收藏相关自定义 Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserApi } from '../api/users';
import { useToast } from '../components/Toast';

// 查询键
export const favoriteKeys = {
  all: ['favorites'] as const,
  list: () => [...favoriteKeys.all, 'list'] as const,
};

/**
 * 获取收藏列表
 */
export function useFavorites() {
  const userApi = useUserApi();

  return useQuery({
    queryKey: favoriteKeys.list(),
    queryFn: async () => {
      const data = await userApi.getFavorites();
      return data.favorites || [];
    },
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

/**
 * 添加收藏
 */
export function useAddFavorite() {
  const userApi = useUserApi();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (characterId: string) => {
      await userApi.addFavorite(characterId);
      return characterId;
    },
    // 乐观更新
    onMutate: async (characterId) => {
      // 取消正在进行的重新获取
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });

      // 保存当前数据用于回滚
      const previousFavorites = queryClient.getQueryData<string[]>(favoriteKeys.list()) || [];

      // 乐观更新
      queryClient.setQueryData<string[]>(favoriteKeys.list(), (old = []) => {
        if (old.includes(characterId)) return old;
        return [...old, characterId];
      });

      return { previousFavorites };
    },
    onError: (error: Error, _characterId, context) => {
      // 回滚
      if (context) {
        queryClient.setQueryData(favoriteKeys.list(), context.previousFavorites);
      }
      showToast(`添加收藏失败: ${error.message}`, 'error');
    },
    onSuccess: () => {
      showToast('已添加到收藏', 'success');
    },
    onSettled: () => {
      // 重新获取最新数据
      queryClient.invalidateQueries({ queryKey: favoriteKeys.list() });
    },
  });
}

/**
 * 移除收藏
 */
export function useRemoveFavorite() {
  const userApi = useUserApi();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (characterId: string) => {
      await userApi.removeFavorite(characterId);
      return characterId;
    },
    // 乐观更新
    onMutate: async (characterId) => {
      await queryClient.cancelQueries({ queryKey: favoriteKeys.list() });

      const previousFavorites = queryClient.getQueryData<string[]>(favoriteKeys.list()) || [];

      queryClient.setQueryData<string[]>(favoriteKeys.list(), (old = []) => {
        return old.filter((id) => id !== characterId);
      });

      return { previousFavorites };
    },
    onError: (error: Error, _characterId, context) => {
      if (context) {
        queryClient.setQueryData(favoriteKeys.list(), context.previousFavorites);
      }
      showToast(`移除收藏失败: ${error.message}`, 'error');
    },
    onSuccess: () => {
      showToast('已从收藏中移除', 'info');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: favoriteKeys.list() });
    },
  });
}

/**
 * 切换收藏状态（添加/移除）
 */
export function useToggleFavorite() {
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const { data: favorites = [] } = useFavorites();

  return {
    toggleFavorite: (characterId: string) => {
      const isFavorite = favorites.includes(characterId);
      if (isFavorite) {
        removeFavorite.mutate(characterId);
      } else {
        addFavorite.mutate(characterId);
      }
    },
    isFavorite: (characterId: string) => favorites.includes(characterId),
    isLoading: addFavorite.isPending || removeFavorite.isPending,
  };
}
