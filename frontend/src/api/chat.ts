/**
 * 聊天相关 API
 */

import { useApiClient } from './client';
import type { ChatMessage, ChatThread } from '../types';

interface SendMessageParams {
  message: string;
  history: Array<{ role: string; text: string }>;
  characterName: string;
  characterDescription: string;
  // V3 角色卡字段
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  system_prompt?: string;
  post_history_instructions?: string;
  alternate_greetings?: string[];
  // 兼容旧字段
  worldBook?: string;
}

interface SendMessageResponse {
  text: string;
  error?: string;
}

interface ProvidersResponse {
  providers: Array<{ id: string; name: string; model?: string }>;
  active: string | null;
}

export function useChatApi() {
  const { get, post } = useApiClient();

  return {
    // 发送聊天消息
    sendMessage: (params: SendMessageParams) =>
      post<SendMessageResponse>('/api/chat', params),

    // 获取聊天线程列表
    getThreads: () =>
      get<ChatThread[]>('/api/chat/threads'),

    // 获取单个聊天线程
    getThread: (characterId: string) =>
      get<ChatThread>(`/api/chat/threads/${characterId}`),

    // 保存聊天
    saveChat: (characterId: string, messages: unknown[]) =>
      post('/api/chats/save', {
        avatar_url: characterId,
        file_name: 'chat',
        chat: messages,
      }),

    // 获取聊天
    getChat: (characterId: string) =>
      post<ChatMessage[]>('/api/chats/get', {
        avatar_url: characterId,
        file_name: 'chat',
      }),

    // 删除聊天
    deleteChat: (characterId: string) =>
      post('/api/chats/delete', {
        avatar_url: characterId,
      }),

    // 重命名聊天
    renameChat: (characterId: string, newName: string) =>
      post('/api/chats/rename', {
        avatar_url: characterId,
        file_name: newName,
      }),

    // 导出聊天
    exportChat: (characterId: string) =>
      post('/api/chats/export', {
        avatar_url: characterId,
      }),

    // 导入聊天
    importChat: (data: unknown) =>
      post('/api/chats/import', data),

    // 获取支持的 LLM providers
    getProviders: () =>
      get<ProvidersResponse>('/api/chat/providers'),

    // 批量删除聊天
    batchDeleteChats: (characterIds: string[]) =>
      post<{ ok: boolean; deletedCount: number }>('/api/chats/batch-delete', {
        characterIds,
      }),

    // 置顶/取消置顶聊天
    pinChat: (characterId: string, pinned: boolean) =>
      post<{ ok: boolean; pinned: boolean }>('/api/chats/pin', {
        characterId,
        pinned,
      }),
  };
}
