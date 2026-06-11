import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { Character } from '../types';
import { useToast } from '../components/Toast';
import { useCharacterApi } from '../api/characters';
import { useUserApi } from '../api/users';
import { useFavorites, useToggleFavorite } from './useFavorites';
import { useCharacterStore } from '../stores/characterStore';
import { useChatStore } from '../stores/chatStore';
import { clearCsrfToken } from '../api/client';
import { track } from '../utils/analytics';

export function useCharacterManagement(navigate: ReturnType<typeof useNavigate>) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const characterApi = useCharacterApi();
  const userApi = useUserApi();
  const { toggleFavorite } = useToggleFavorite();
  const { data: favoriteIds = [] } = useFavorites();
  const {
    characters,
    updateCharacter: storeUpdateChar,
    removeCharacter: storeRemoveChar,
    setEditingCharacter,
  } = useCharacterStore();

  // ── Load characters on mount ──
  useEffect(() => {
    Promise.all([
      characterApi.getDiscoverCharacters().catch(() => []),
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
    ]).then(([discoverData, charsData, pngCharsData]) => {
      if (Array.isArray(discoverData) && discoverData.length > 0) {
        useCharacterStore.getState().setCharacters(discoverData);
      }
      const mergeChars = (data: Character[]) => {
        if (Array.isArray(data) && data.length > 0) {
          useCharacterStore.getState().addCharacters(data);
        }
      };
      mergeChars(charsData);
      mergeChars(pngCharsData);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login/Logout ──
  const handleLogin = useCallback(async (input: string, password?: string) => {
    clearCsrfToken(); // 新 session 需要新 CSRF token
    const data = await userApi.login({ handle: input, password });
    queryClient.setQueryData(['user', 'me'], { handle: data.handle || input, name: data.handle });
    showToast(`欢迎回来，${data.handle || input}！`, 'success');
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    track('login', { username: data.handle || input });
  }, [showToast, userApi, queryClient]);

  const handleGoogleLogin = useCallback(async (idToken: string) => {
    clearCsrfToken();
    try {
      await userApi.googleLogin(idToken);
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      showToast(`Google 登录失败: ${message}`, 'error');
      throw err;
    }
  }, [showToast, userApi, queryClient]);

  const handleRegister = useCallback(async (username: string, email: string, password?: string) => {
    clearCsrfToken();
    await userApi.register({ handle: username, name: username, password, email });
    queryClient.setQueryData(['user', 'me'], { handle: username, name: username });
    showToast('注册成功，欢迎加入！', 'success');
    queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    queryClient.invalidateQueries({ queryKey: ['favorites', 'list'] });
    track('register', { username });
  }, [showToast, userApi, queryClient]);

  const handleLogout = useCallback(async () => {
    clearCsrfToken(); // 清除旧 session 的 CSRF token
    track('logout');
    await userApi.logout().catch(() => {});
    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => k.startsWith('simpletavern-')).map(k => caches.delete(k)));
      } catch { /* ignore */ }
    }
    queryClient.clear();
    useChatStore.getState().clearChatThreads();
    useChatStore.getState().resetLoaded();
    // Reload discover data for anonymous view
    characterApi.getDiscoverCharacters()
      .then(data => {
        if (Array.isArray(data)) useCharacterStore.getState().setCharacters(data);
      })
      .catch(() => {});
    navigate('/', { replace: true });
  }, [characterApi, userApi, queryClient, navigate]);

  // ── Character operations ──
  const handleToggleFavorite = useCallback((characterId: string) => {
    toggleFavorite(characterId);
    track('toggle_favorite', { character_id: characterId, source: 'button' });
  }, [toggleFavorite]);

  const handlePublishCharacter = useCallback(async (newChar: Character) => {
    const editChar = useCharacterStore.getState().editingCharacter;
    const isEdit = !!editChar;
    if (isEdit) {
      const isPngCharacter = editChar.id.endsWith('.png');
      if (isPngCharacter) {
        await characterApi.updateCharacter({ ...newChar, avatar_url: editChar.id, avatar: editChar.id });
        storeUpdateChar(newChar);
      } else {
        const saved = await characterApi.updateUserCharacter(newChar);
        storeUpdateChar(saved);
      }
      setEditingCharacter(null);
    } else {
      const saved = await characterApi.publishCharacter(newChar);
      storeRemoveChar(saved.id);
      const currentChars = useCharacterStore.getState().characters;
      useCharacterStore.getState().setCharacters([saved, ...currentChars]);
      track('create_character', { character_id: saved.id, character_name: saved.name });
    }
  }, [characterApi, storeUpdateChar, setEditingCharacter, storeRemoveChar]);

  const handleAddReview = useCallback(async (characterId: string, review: Character['reviews'] extends (infer R)[] | undefined ? R : never) => {
    try {
      const updatedChar = await characterApi.addReview(characterId, review);
      storeUpdateChar(updatedChar);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '评价提交失败';
      showToast(message, 'error');
      throw err;
    }
  }, [characterApi, showToast, storeUpdateChar]);

  const handleUpdatePrivacy = useCallback(async (characterId: string, privacyType: 'public' | 'private') => {
    try {
      const updated = await characterApi.updateCharacterPrivacy(characterId, privacyType);
      storeUpdateChar(updated);
      showToast(privacyType === 'public' ? '角色已设为公开' : '角色已设为私有', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '隐私设置修改失败';
      showToast(message, 'error');
    }
  }, [characterApi, showToast, storeUpdateChar]);

  const handleCopyCharacter = useCallback(async (character: Character) => {
    try {
      const copy = await characterApi.copyCharacter(character);
      const currentChars = useCharacterStore.getState().characters;
      useCharacterStore.getState().setCharacters([copy, ...currentChars.filter(c => c.id !== copy.id)]);
      showToast(`已复制角色「${copy.name}」到我的角色（私有）`, 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '复制角色失败';
      showToast(message, 'error');
    }
  }, [characterApi, showToast]);

  const handleDeleteCharacter = useCallback(async (characterId: string) => {
    const charStore = useCharacterStore.getState();
    const char = charStore.characters.find(c => c.id === characterId);
    if (!char) return;
    try {
      if (char.id.startsWith('custom_')) {
        await characterApi.deleteUserCharacter(characterId);
      } else if (char.id.endsWith('.png')) {
        await characterApi.deleteCharacter(char.id);
      } else {
        await characterApi.deleteCharacter(char.avatar);
      }
      storeRemoveChar(characterId);
      showToast('角色已删除', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败';
      showToast(message, 'error');
    }
  }, [characterApi, showToast, storeRemoveChar]);

  const characterApiRefresh = useCallback(async () => {
    const data = await characterApi.getDiscoverCharacters();
    if (Array.isArray(data) && data.length > 0) {
      useCharacterStore.getState().setCharacters(data);
    }
  }, [characterApi]);

  return {
    characters,
    editingCharacter: useCharacterStore.getState().editingCharacter ?? null,
    setEditingCharacter,
    favoriteIds,
    handleLogin,
    handleGoogleLogin,
    handleRegister,
    handleLogout,
    handleToggleFavorite,
    handlePublishCharacter,
    handleAddReview,
    handleUpdatePrivacy,
    handleCopyCharacter,
    handleDeleteCharacter,
    characterApiRefresh,
  };
}
