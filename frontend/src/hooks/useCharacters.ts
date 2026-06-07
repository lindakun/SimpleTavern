/**
 * 角色相关自定义 Hooks
 *
 * 使用 React Query 管理角色数据的获取和缓存
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCharacterApi } from '../api/characters';
import type { Review } from '../types';

// Query Keys - 集中管理
export const characterKeys = {
  all: ['characters'] as const,
  discover: () => [...characterKeys.all, 'discover'] as const,
  myCharacters: () => [...characterKeys.all, 'myCharacters'] as const,
  detail: (id: string) => [...characterKeys.all, 'detail', id] as const,
  reviews: (id: string) => [...characterKeys.all, 'reviews', id] as const,
};

// 获取发现页角色列表
export function useDiscoverCharacters() {
  const api = useCharacterApi();

  return useQuery({
    queryKey: characterKeys.discover(),
    queryFn: api.getDiscoverCharacters,
    staleTime: 5 * 60 * 1000, // 5分钟
  });
}

// 获取用户创建的角色
export function useMyCharacters() {
  const api = useCharacterApi();

  return useQuery({
    queryKey: characterKeys.myCharacters(),
    queryFn: api.getMyCharacters,
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

// 创建角色
export function useCreateCharacter() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.createCharacter,
    onSuccess: () => {
      // 创建成功后刷新列表
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.discover() });
    },
  });
}

// 更新角色
export function useUpdateCharacter() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.updateCharacter,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(data.id) });
    },
  });
}

// 删除角色
export function useDeleteCharacter() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.deleteCharacter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.discover() });
    },
  });
}

// 发布角色
export function usePublishCharacter() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.publishCharacter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.discover() });
    },
  });
}

// 提交评价
export function useAddReview(characterId: string) {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (review: Omit<Review, 'id'>) => api.addReview(characterId, review),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.reviews(characterId) });
      queryClient.invalidateQueries({ queryKey: characterKeys.detail(characterId) });
    },
  });
}

// 导出角色
export function useExportCharacter() {
  const api = useCharacterApi();

  return useMutation({
    mutationFn: api.exportCharacter,
  });
}

// 导入角色
export function useImportCharacter() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.importCharacter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.discover() });
    },
  });
}

// 快捷切换角色隐私类型
export function useUpdateCharacterPrivacy() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, privacyType }: { characterId: string; privacyType: 'public' | 'private' }) =>
      api.updateCharacterPrivacy(characterId, privacyType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.discover() });
    },
  });
}

// 复制公共角色
export function useCopyCharacter() {
  const api = useCharacterApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ characterId, sourceHandle }: { characterId: string; sourceHandle: string }) =>
      api.copyCharacter(characterId, sourceHandle),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.myCharacters() });
      queryClient.invalidateQueries({ queryKey: characterKeys.discover() });
    },
  });
}
