import { useState, useEffect, useCallback, useRef } from 'react';
import { type Character, type ChatMessage, type ChatThread } from '../types';
import { useToast } from '../components/Toast';
import { useChatApi } from '../api/chat';
import { useCharacterApi } from '../api/characters';
import { useCharacterStore } from '../stores/characterStore';
import { ScreenId } from '../types';
import { useChatStore } from '../stores/chatStore';
import { useCurrentUser } from './useAuth';
import { fromStoredChatMessages, toStoredChatMessages } from '../utils/chatMessages';
import { cacheMessages, cacheThreads, getCachedMessages, getCachedThreads } from '../utils/chatCache';
import { getEffectiveUserName, loadChatSettings } from '../utils/chatSettings';

type StreamMode = 'send' | 'regenerate' | 'edit';

export function useChatFlow(currentScreen: ScreenId | null) {
  const { showToast } = useToast();
  const chatApi = useChatApi();
  const characterApi = useCharacterApi();
  const { data: currentUser, isFetched } = useCurrentUser();

  const abortControllerRef = useRef<AbortController | null>(null);
  const [activeCharacterId, setActiveCharacterId] = useState<string>('yuki');

  const {
    chatThreads, sendingStates,
    updateChatThread, deleteChatThreads,
    markLoaded,
  } = useChatStore();

  const clearUnreadCount = useCallback((characterId: string) => {
    const store = useChatStore.getState();
    if (store.chatThreads[characterId]) {
      store.updateChatThread(characterId, (prev) => ({ ...prev, unreadCount: 0 }));
    }
  }, []);

  /**
   * 核心流式生成
   * - send: 追加 user 消息再生成
   * - regenerate: 基于已有 history（不含待替换 AI 条）生成，不追加 user
   * - edit: history 已含编辑后的 user（末条），不重复追加 user
   */
  const runStream = useCallback(async (
    characterId: string,
    opts: {
      mode: StreamMode;
      /** 发给模型的「当前用户消息」文本 */
      messageText: string;
      /** 生成前的历史（不含占位 AI，send 时也不含本轮 user） */
      historyMessages: ChatMessage[];
      /** send 模式下要展示的 user 消息；regenerate/edit 为 null */
      displayUserMsg: ChatMessage | null;
    },
  ) => {
    const chatStore = useChatStore.getState();
    const charStore = useCharacterStore.getState();

    const curState = chatStore.sendingStates[characterId] || 'idle';
    if (curState === 'sending' || curState === 'streaming') {
      showToast('AI 正在回复中，请等待回复完成后再发送', 'info');
      return;
    }

    const chatCharacter = charStore.characters.find((c) => c.id === characterId)
      || charStore.characters[0];
    if (!chatCharacter) {
      showToast('角色不存在', 'error');
      return;
    }

    const baseMessages = opts.displayUserMsg
      ? [...opts.historyMessages, opts.displayUserMsg]
      : [...opts.historyMessages];

    const aiPlaceholderId = 'msg_ai_' + Date.now();
    const aiPlaceholder: ChatMessage = {
      id: aiPlaceholderId,
      role: 'model',
      text: '',
      timestamp: new Date().toISOString(),
    };

    const currentThread = chatStore.chatThreads[characterId] || {
      characterId,
      messages: [],
      unreadCount: 0,
    };

    chatStore.setChatThreads({
      ...chatStore.chatThreads,
      [characterId]: {
        ...currentThread,
        characterId,
        messages: [...baseMessages, aiPlaceholder],
        unreadCount: 0,
      },
    });
    chatStore.setSendState(characterId, 'sending');

    const settings = loadChatSettings();
    const userName = getEffectiveUserName(
      (currentUser as { handle?: string; name?: string } | undefined)?.handle
      || (currentUser as { handle?: string; name?: string } | undefined)?.name,
    );
    let streamedText = '';

    // 发送前清洗污染消息（失败/中断占位不进模型上下文）
    const cleanHistory = opts.historyMessages
      .filter((m) => {
        const t = m.text || '';
        if (!t.trim()) return false;
        if (/发生连接断裂|发送失败|\[已中断\]/.test(t)) return false;
        return true;
      })
      .map((m) => ({ role: m.role, text: m.text }));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await new Promise<void>((resolve, reject) => {
        chatApi.sendMessageStream(
          {
            message: opts.messageText,
            history: cleanHistory,
            characterName: chatCharacter.name,
            characterDescription: chatCharacter.description,
            personality: chatCharacter.personality,
            scenario: chatCharacter.scenario,
            first_mes: chatCharacter.first_mes,
            mes_example: chatCharacter.mes_example,
            system_prompt: chatCharacter.system_prompt,
            post_history_instructions: chatCharacter.post_history_instructions,
            alternate_greetings: chatCharacter.alternate_greetings,
            worldBook: chatCharacter.worldBook,
            character_book: chatCharacter.character_book,
            tagline: chatCharacter.tagline,
            provider: settings.providerId || undefined,
            userName,
            // 不强制每轮注入 first_mes；由后端在 history 为空时自动注入
            // frequency_penalty 交由后端按本地/云端默认，避免本地过早收束
            temperature: settings.temperature,
            responseLength: settings.responseLength,
          },
          (chunk: string) => {
            if (!streamedText) {
              useChatStore.getState().setSendState(characterId, 'streaming');
            }
            streamedText += chunk;
            useChatStore.getState().updateChatThread(characterId, (thread) => {
              const msgs = thread.messages.map((m) =>
                m.id === aiPlaceholderId ? { ...m, text: streamedText } : m,
              );
              return { ...thread, messages: msgs };
            });
          },
          () => {
            const finalMessages = [
              ...baseMessages,
              { ...aiPlaceholder, text: streamedText || '……发生连接断裂。' },
            ];
            chatApi.saveChat(characterId, toStoredChatMessages(chatCharacter, finalMessages, userName)).catch(() => {});
            cacheMessages(characterId, finalMessages);
            useChatStore.getState().setSendState(characterId, 'idle');
            resolve();
          },
          (err: Error) => {
            const message = err.message || '消息发送失败';
            // abort 时不弹错误 toast
            if (err.name !== 'AbortError' && !/abort/i.test(message)) {
              showToast(`消息发送失败: ${message}`, 'error');
            }
            const errorMsg: ChatMessage = {
              id: 'msg_err_' + Date.now(),
              role: 'model',
              text: streamedText
                ? streamedText + '\n[已中断]'
                : `（发送失败：${message}）`,
              timestamp: new Date().toISOString(),
            };
            const store = useChatStore.getState();
            const finalMessages = [...baseMessages, errorMsg];
            store.setChatThreads({
              ...store.chatThreads,
              [characterId]: {
                ...store.chatThreads[characterId],
                characterId,
                messages: finalMessages,
                unreadCount: 0,
              },
            });
            if (streamedText) {
              chatApi.saveChat(characterId, toStoredChatMessages(chatCharacter, finalMessages, userName)).catch(() => {});
              cacheMessages(characterId, finalMessages);
            }
            useChatStore.getState().setSendState(characterId, 'error');
            reject(err);
          },
          abortController.signal,
        );
      });
    } catch {
      useChatStore.getState().setSendState(characterId, 'error');
    }
  }, [chatApi, showToast, currentUser]);

  // ── 发送新消息 ──
  const handleSendMessage = useCallback(async (characterId: string, text: string) => {
    const chatStore = useChatStore.getState();
    const currentThread = chatStore.chatThreads[characterId] || {
      characterId,
      messages: [] as ChatMessage[],
      unreadCount: 0,
    };
    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    await runStream(characterId, {
      mode: 'send',
      messageText: text,
      historyMessages: currentThread.messages,
      displayUserMsg: userMsg,
    });
  }, [runStream]);

  // ── 重新生成：删除目标 AI 条及之后，不重复追加 user ──
  const handleRegenerateMessage = useCallback(async (characterId: string, messageId: string) => {
    const store = useChatStore.getState();
    const thread = store.chatThreads[characterId];
    if (!thread) return;

    const msgIdx = thread.messages.findIndex((m) => m.id === messageId);
    if (msgIdx < 0) return;

    // 向前找对应的 user 消息
    let userIdx = -1;
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (thread.messages[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) {
      showToast('找不到对应的用户消息，无法重新生成', 'error');
      return;
    }

    const userText = thread.messages[userIdx].text;
    // 历史 = user 之前的消息；display 含 user（不重复发）
    const historyBeforeUser = thread.messages.slice(0, userIdx);
    const userMsg = thread.messages[userIdx];

    await runStream(characterId, {
      mode: 'regenerate',
      messageText: userText,
      historyMessages: historyBeforeUser,
      displayUserMsg: userMsg,
    });
  }, [runStream, showToast]);

  // ── 编辑用户消息：截断到该条并改文案，再生成（不二次 push user）──
  const handleEditMessage = useCallback(async (characterId: string, messageId: string, newText: string) => {
    const store = useChatStore.getState();
    const thread = store.chatThreads[characterId];
    if (!thread) return;
    const msgIdx = thread.messages.findIndex((m) => m.id === messageId);
    if (msgIdx === -1) return;

    const historyBefore = thread.messages.slice(0, msgIdx);
    const editedUser: ChatMessage = {
      ...thread.messages[msgIdx],
      text: newText,
      role: 'user',
    };

    await runStream(characterId, {
      mode: 'edit',
      messageText: newText,
      historyMessages: historyBefore,
      displayUserMsg: editedUser,
    });
  }, [runStream]);

  // ── 停止生成 ──
  const handleStopGeneration = useCallback((characterId: string) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const store = useChatStore.getState();
    const charStore = useCharacterStore.getState();
    const thread = store.chatThreads[characterId];
    if (thread) {
      const msgs = thread.messages.map((m, i) => {
        if (i === thread.messages.length - 1 && m.role === 'model') {
          return { ...m, text: m.text ? m.text + '\n[已中断]' : '[已中断]' };
        }
        return m;
      });
      store.updateChatThread(characterId, () => ({ ...thread, messages: msgs }));
      const chatChar = charStore.characters.find((c) => c.id === characterId) || charStore.characters[0];
      if (chatChar) {
        chatApi.saveChat(characterId, toStoredChatMessages(chatChar, msgs)).catch(() => {});
        cacheMessages(characterId, msgs);
      }
    }
    store.setSendState(characterId, 'idle');
  }, [chatApi]);

  // ── 删除消息 ──
  const handleDeleteMessage = useCallback((characterId: string, messageId: string) => {
    const chatStore = useChatStore.getState();
    const thread = chatStore.chatThreads[characterId];
    if (!thread) return;
    const newMessages = thread.messages.filter((m) => m.id !== messageId);
    chatStore.updateChatThread(characterId, () => ({
      ...thread,
      messages: newMessages,
    }));
    const charStore = useCharacterStore.getState();
    const chatChar = charStore.characters.find((c) => c.id === characterId) || charStore.characters[0];
    if (chatChar) {
      chatApi.saveChat(characterId, toStoredChatMessages(chatChar, newMessages)).catch(() => {});
      cacheMessages(characterId, newMessages);
    }
  }, [chatApi]);

  // ── 新对话：清空当前角色消息（保留角色）──
  const handleNewChat = useCallback((characterId: string, greetingIndex?: number) => {
    const chatStore = useChatStore.getState();
    const charStore = useCharacterStore.getState();
    const chatChar = charStore.characters.find((c) => c.id === characterId);

    // 可选：把 alternate_greeting 作为首条 AI 消息写入
    let messages: ChatMessage[] = [];
    if (chatChar && typeof greetingIndex === 'number' && greetingIndex >= 0) {
      const greets = [
        chatChar.first_mes,
        ...(chatChar.alternate_greetings || []),
      ].filter((g): g is string => Boolean(g?.trim()));
      const pick = greets[greetingIndex] || greets[0];
      if (pick) {
        const text = pick
          .replace(/\{\{char\}\}/gi, chatChar.name)
          .replace(/\{\{user\}\}/gi, getEffectiveUserName(
            (currentUser as { handle?: string } | undefined)?.handle,
          ));
        messages = [{
          id: 'msg_greet_' + Date.now(),
          role: 'model',
          text,
          timestamp: new Date().toISOString(),
        }];
      }
    }

    chatStore.updateChatThread(characterId, (prev) => ({
      ...prev,
      characterId,
      messages,
      unreadCount: 0,
      lastMessageText: messages[0]?.text || '',
    }));

    if (chatChar) {
      chatApi.saveChat(characterId, toStoredChatMessages(chatChar, messages)).catch(() => {});
      cacheMessages(characterId, messages);
    }
    showToast('已开始新对话', 'success');
  }, [chatApi, showToast, currentUser]);

  // ── Chat thread loading (anonymous) ──
  useEffect(() => {
    if (!isFetched || currentUser) return;
    chatApi.getThreads()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const chatStore = useChatStore.getState();
          const merged = { ...chatStore.chatThreads };
          for (const thread of data) {
            if (!merged[thread.characterId]) {
              merged[thread.characterId] = {
                ...thread,
                messages: thread.messages || [],
                unreadCount: thread.unreadCount || 0,
              };
            }
          }
          chatStore.setChatThreads(merged);
          cacheThreads(data as any);
        }
      })
      .catch(() => {});
  }, [isFetched, currentUser, chatApi]);

  // ── Chat thread loading (logged-in) ──
  useEffect(() => {
    if (!currentUser) return;
    useChatStore.getState().clearChatThreads();
    Promise.all([
      characterApi.getMyCharacters().catch(() => []),
      characterApi.getUserPngCharacters().catch(() => []),
      chatApi.getThreads().catch(() => []),
    ]).then(([charsData, pngCharsData, threadsData]) => {
      const mergeChars = (data: Character[]) => {
        if (Array.isArray(data) && data.length > 0) {
          useCharacterStore.getState().addCharacters(data);
        }
      };
      mergeChars(charsData);
      mergeChars(pngCharsData);
      if (Array.isArray(threadsData)) {
        const threads: Record<string, ChatThread> = {};
        for (const thread of threadsData) {
          threads[thread.characterId] = {
            ...thread,
            messages: thread.messages || [],
            unreadCount: thread.unreadCount || 0,
          };
        }
        useChatStore.getState().setChatThreads(threads);
        cacheThreads(threadsData as any);
      }
    })
      .catch(() => {
        getCachedThreads().then((cached) => {
          if (cached.length > 0) {
            const threads: Record<string, ChatThread> = {};
            for (const thread of cached) {
              threads[thread.characterId] = {
                characterId: thread.characterId,
                messages: [],
                unreadCount: 0,
                lastMessageText: thread.lastMessageText,
                updatedAt: new Date(thread.updatedAt).toISOString(),
                pinned: thread.pinned,
              };
            }
            useChatStore.getState().setChatThreads(threads);
          }
        });
      });
  }, [currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load chat history when entering chat ──
  const loadedChats = useChatStore((s) => s.loadedChats);
  useEffect(() => {
    if (currentScreen !== ScreenId.CHAT || !activeCharacterId) return;
    if (loadedChats.has(activeCharacterId)) return;
    markLoaded(activeCharacterId);
    chatApi.getChat(activeCharacterId)
      .then((data) => {
        const messages = fromStoredChatMessages(data);
        if (messages.length > 0) {
          useChatStore.getState().updateChatThread(activeCharacterId, (prev) => ({
            ...prev,
            characterId: activeCharacterId,
            messages,
            unreadCount: 0,
          }));
          cacheMessages(activeCharacterId, messages);
        }
      })
      .catch(() => {
        getCachedMessages(activeCharacterId).then((cached) => {
          if (cached.length > 0) {
            useChatStore.getState().updateChatThread(activeCharacterId, (prev) => ({
              ...prev,
              characterId: activeCharacterId,
              messages: cached,
              unreadCount: 0,
            }));
          }
        });
      });
  }, [activeCharacterId, currentScreen]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeCharacterId,
    setActiveCharacterId,
    chatThreads,
    sendingStates,
    updateChatThread,
    deleteChatThreads,
    markLoaded,
    clearUnreadCount,
    handleSendMessage,
    handleStopGeneration,
    handleEditMessage,
    handleDeleteMessage,
    handleRegenerateMessage,
    handleNewChat,
  };
}
