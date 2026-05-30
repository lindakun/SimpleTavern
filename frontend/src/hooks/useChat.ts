/**
 * 聊天相关自定义 Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatApi } from '../api/chat';
import { useToast } from '../components/Toast';
import type { ChatMessage } from '../types';

// 查询键
export const chatKeys = {
  all: ['chat'] as const,
  threads: () => [...chatKeys.all, 'threads'] as const,
  thread: (characterId: string) => [...chatKeys.threads(), characterId] as const,
  messages: (characterId: string) => [...chatKeys.thread(characterId), 'messages'] as const,
};

/**
 * 获取聊天线程列表
 */
export function useChatThreads() {
  const chatApi = useChatApi();

  return useQuery({
    queryKey: chatKeys.threads(),
    queryFn: chatApi.getThreads,
    staleTime: 2 * 60 * 1000, // 2分钟
  });
}

/**
 * 获取单个聊天线程
 */
export function useChatThread(characterId: string) {
  const chatApi = useChatApi();

  return useQuery({
    queryKey: chatKeys.thread(characterId),
    queryFn: () => chatApi.getThread(characterId),
    enabled: !!characterId,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * 发送聊天消息
 */
export function useSendMessage() {
  const chatApi = useChatApi();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      message,
      history,
      characterName,
      characterDescription,
      worldBook,
      characterId,
    }: {
      message: string;
      history: Array<{ role: string; text: string }>;
      characterName: string;
      characterDescription: string;
      worldBook?: string;
      characterId: string;
    }) => {
      const response = await chatApi.sendMessage({
        message,
        history,
        characterName,
        characterDescription,
        worldBook,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      return {
        text: response.text || '……发生连接断裂。',
        characterId,
      };
    },
    onSuccess: (_data, variables) => {
      // 更新聊天线程缓存
      queryClient.invalidateQueries({
        queryKey: chatKeys.thread(variables.characterId),
      });
    },
    onError: (error: Error) => {
      showToast(`消息发送失败: ${error.message}`, 'error');
    },
  });
}

/**
 * 保存聊天记录
 */
export function useSaveChat() {
  const chatApi = useChatApi();

  return useMutation({
    mutationFn: async ({
      characterId,
      messages,
    }: {
      characterId: string;
      messages: ChatMessage[];
    }) => {
      await chatApi.saveChat(characterId, messages);
    },
  });
}

/**
 * 获取聊天记录（用于加载历史消息）
 */
export function useLoadChat(characterId: string) {
  const chatApi = useChatApi();

  return useQuery({
    queryKey: chatKeys.messages(characterId),
    queryFn: () => chatApi.getChat(characterId),
    enabled: !!characterId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 删除聊天记录
 */
export function useDeleteChat() {
  const chatApi = useChatApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterId: string) => {
      await chatApi.deleteChat(characterId);
    },
    onSuccess: (_, characterId) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.thread(characterId),
      });
      queryClient.invalidateQueries({
        queryKey: chatKeys.threads(),
      });
    },
  });
}

/**
 * 导出聊天记录
 */
export function useExportChat() {
  const chatApi = useChatApi();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: async (characterId: string) => {
      await chatApi.exportChat(characterId);
      showToast('聊天记录已导出', 'success');
    },
  });
}

/**
 * 获取支持的 LLM Providers
 */
export function useProviders() {
  const chatApi = useChatApi();

  return useQuery({
    queryKey: ['chat', 'providers'],
    queryFn: chatApi.getProviders,
    staleTime: 30 * 60 * 1000, // 30分钟
  });
}

/**
 * 批量删除聊天
 */
export function useBatchDeleteChats() {
  const chatApi = useChatApi();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (characterIds: string[]) => {
      return chatApi.batchDeleteChats(characterIds);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.threads() });
      showToast(`已删除 ${data.deletedCount} 个聊天`, 'success');
    },
    onError: (error: Error) => {
      showToast(`批量删除失败: ${error.message}`, 'error');
    },
  });
}

/**
 * 置顶/取消置顶聊天
 */
export function useTogglePinChat() {
  const chatApi = useChatApi();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ characterId, pinned }: { characterId: string; pinned: boolean }) => {
      return chatApi.pinChat(characterId, pinned);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.threads() });
      showToast(variables.pinned ? '已置顶' : '已取消置顶', 'success');
    },
    onError: (error: Error) => {
      showToast(`操作失败: ${error.message}`, 'error');
    },
  });
}
