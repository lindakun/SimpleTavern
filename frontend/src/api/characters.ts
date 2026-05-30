/**
 * 角色相关 API
 */

import { useApiClient } from './client';
import type { Character, Review } from '../types';

export function useCharacterApi() {
  const { get, post } = useApiClient();

  return {
    // 获取发现页角色列表
    getDiscoverCharacters: () =>
      get<Character[]>('/api/discover'),

    // 获取单个角色详情
    getCharacter: (id: string) =>
      get<Character>(`/api/discover/${id}`),

    // 获取用户创建的角色
    getMyCharacters: () =>
      get<Character[]>('/api/users/characters'),

    // 创建角色
    createCharacter: (character: Character) =>
      post<Character>('/api/characters/create', character),

    // 更新角色
    updateCharacter: (character: Character) =>
      post<Character>('/api/characters/edit', character),

    // 更新用户发布角色（node-persist 自定义角色）
    updateUserCharacter: (character: Character) =>
      post<Character>('/api/users/characters/edit', character),

    // 删除角色
    deleteCharacter: (avatarUrl: string) =>
      post('/api/characters/delete', { avatar_url: avatarUrl }),

    // 删除用户发布角色（node-persist 自定义角色）
    deleteUserCharacter: (characterId: string) =>
      post('/api/users/characters/delete', { characterId }),

    // 发布角色
    publishCharacter: (character: Character) =>
      post<Character>('/api/characters/publish', character),

    // 提交评价
    addReview: (characterId: string, review: Omit<Review, 'id'>) =>
      post<Character>(`/api/discover/${characterId}/reviews`, review),

    // 导出角色
    exportCharacter: (id: string) =>
      post(`/api/characters/export`, { id }),

    // 导入角色
    importCharacter: (data: unknown) =>
      post('/api/characters/import', data),
  };
}
