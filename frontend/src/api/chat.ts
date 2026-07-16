/**
 * 聊天相关 API
 */

import { useApiClient } from './client';
import type { ChatThread } from '../types';

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
  character_book?: unknown;
  tagline?: string;
  provider?: string;
  userName?: string;
  includeFirstMes?: boolean;
  temperature?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  responseLength?: string | number;
  max_tokens?: number;
  promptStrictness?: 'light' | 'standard' | 'strict';
  continueMode?: boolean;
}

export interface StreamDoneMeta {
  finishReason?: string;
}

interface SendMessageResponse {
  text: string;
  error?: string;
}

interface ProvidersResponse {
  providers: Array<{ id: string; name: string; model?: string; isLocal?: boolean; active?: boolean }>;
  active: string | null;
}

export function useChatApi() {
  const { get, post } = useApiClient();

  return {
    // 发送聊天消息（AI 生成可能耗时较长，超时设为 3 分钟）
    sendMessage: (params: SendMessageParams) =>
      post<SendMessageResponse>('/api/chat', params, { timeout: 180000 }),

    // 流式聊天 — 通过 SSE 逐 token 接收，onChunk 每次收到文本片段时调用
    // ⚠️ 此处使用原生 fetch() 绕过 useApiClient，因此不附带 CSRF token。
    //    /api/chat/stream 作为公开端点注册在 CSRF 中间件之前，所以不受影响。
    //    如需迁移到受保护端点，请改用 request() 方法以自动包含 x-csrf-token 头。
    sendMessageStream: async (
      params: SendMessageParams,
      onChunk: (text: string) => void,
      onDone: (meta?: StreamDoneMeta) => void,
      onError: (err: Error) => void,
      externalSignal?: AbortSignal,
    ) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000); // 3分钟超时

      // 当外部 signal 被 abort 时，也 abort 内部 controller
      if (externalSignal) {
        if (externalSignal.aborted) {
          clearTimeout(timeoutId);
          controller.abort();
        } else {
          externalSignal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            controller.abort();
          }, { once: true });
        }
      }

      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(params),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({} as Record<string, unknown>));
          // 后端错误契约为 { code, message }，旧字段 error 一并兼容
          const msg =
            (errData as { message?: string; error?: string })?.message
            || (errData as { message?: string; error?: string })?.error
            || `HTTP ${response.status}`;
          throw new Error(msg);
        }

        if (!response.body) {
          throw new Error('浏览器不支持流式响应');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finished = false;
        let doneMeta: StreamDoneMeta = {};

        const handleLine = (line: string): 'done' | 'error' | 'ok' => {
          if (!line.startsWith('data: ')) return 'ok';
          const data = line.slice(6).trim();
          if (!data) return 'ok';
          if (data === '[DONE]') {
            return 'done';
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              onError(new Error(parsed.error));
              return 'error';
            }
            if (parsed.text) {
              onChunk(parsed.text);
            }
            if (parsed.done === true || parsed.finishReason) {
              doneMeta = {
                finishReason: parsed.finishReason || doneMeta.finishReason,
              };
            }
            // meta 包忽略
          } catch {
            // 跳过无法解析的行
          }
          return 'ok';
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const r = handleLine(line);
            if (r === 'done') {
              finished = true;
              onDone(doneMeta);
              return;
            }
            if (r === 'error') return;
          }
        }
        // 流结束时刷尽半包，避免丢最后几个字
        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const line of buffer.split('\n')) {
            const r = handleLine(line);
            if (r === 'done') {
              finished = true;
              onDone(doneMeta);
              return;
            }
            if (r === 'error') return;
          }
        }
        if (!finished) onDone(doneMeta);
      } catch (err: unknown) {
        onError(err instanceof Error ? err : new Error('流式请求失败'));
      } finally {
        clearTimeout(timeoutId);
      }
    },

    // 获取聊天线程列表
    getThreads: () =>
      get<ChatThread[]>('/api/chat/threads'),

    // 获取单个聊天线程
    getThread: (characterId: string) =>
      get<ChatThread>(`/api/chat/threads/${characterId}`),

    // 保存聊天（fileName 默认 chat，支持多会话）
    saveChat: (characterId: string, messages: unknown[], fileName = 'chat') =>
      post('/api/chats/save', {
        avatar_url: characterId,
        file_name: fileName,
        chat: messages,
      }),

    /**
     * 获取聊天
     * - 默认 limit=50 分页（从末尾取）
     * - limit=0 拉全量（兼容）
     */
    getChat: (
      characterId: string,
      opts?: { limit?: number; offset?: number; fileName?: string },
    ) =>
      post<
        | unknown[]
        | {
            chat: unknown[];
            hasMore: boolean;
            totalMessages: number;
            offset: number;
            limit: number;
          }
      >('/api/chats/get', {
        avatar_url: characterId,
        file_name: opts?.fileName || 'chat',
        limit: opts?.limit ?? 50,
        offset: opts?.offset ?? 0,
      }),

    // 删除聊天（指定会话文件）
    deleteChat: (characterId: string, fileName = 'chat') =>
      post('/api/chats/delete', {
        avatar_url: characterId,
        file_name: fileName,
      }),

    // 重命名聊天
    renameChat: (characterId: string, newName: string, originalFile = 'chat') =>
      post('/api/chats/rename', {
        avatar_url: characterId,
        original_file: originalFile,
        renamed_file: newName,
      }),

    // 导出聊天
    exportChat: (characterId: string, fileName = 'chat') =>
      post('/api/chats/export', {
        avatar_url: characterId,
        file_name: fileName,
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
