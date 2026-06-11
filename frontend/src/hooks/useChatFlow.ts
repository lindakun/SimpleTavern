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

  // ── Clear unread count when selecting a character from discover ──
  const clearUnreadCount = useCallback((characterId: string) => {
    const store = useChatStore.getState();
    if (store.chatThreads[characterId]) {
      store.updateChatThread(characterId, (prev) => ({ ...prev, unreadCount: 0 }));
    }
  }, []);

  // ── Send message (SSE streaming) ──
  const handleSendMessage = useCallback(async (characterId: string, text: string) => {
    const chatStore = useChatStore.getState();
    const charStore = useCharacterStore.getState();

    const curState = chatStore.sendingStates[characterId] || 'idle';
    if (curState === 'sending' || curState === 'streaming') {
      showToast('AI 正在回复中，请等待回复完成后再发送', 'info');
      return;
    }

    const userMsg: ChatMessage = {
      id: 'msg_user_' + Date.now(),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    const currentThread = chatStore.chatThreads[characterId] || {
      characterId,
      messages: [],
      unreadCount: 0,
    };

    const updatedThreadMessages = [...currentThread.messages, userMsg];

    const aiPlaceholderId = 'msg_ai_' + Date.now();
    const aiPlaceholder: ChatMessage = {
      id: aiPlaceholderId,
      role: 'model',
      text: '',
      timestamp: new Date().toISOString(),
    };

    chatStore.setChatThreads({
      ...chatStore.chatThreads,
      [characterId]: {
        ...currentThread,
        messages: [...updatedThreadMessages, aiPlaceholder],
      },
    });

    chatStore.setSendState(characterId, 'sending');

    const chatCharacter = charStore.characters.find((c) => c.id === characterId)
      || charStore.characters[0];
    if (!chatCharacter) {
      showToast('角色不存在', 'error');
      chatStore.setSendState(characterId, 'error');
      return;
    }

    let streamedText = '';

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await new Promise<void>((resolve, reject) => {
        chatApi.sendMessageStream(
          {
            message: text,
            history: currentThread.messages.map((m) => ({ role: m.role, text: m.text })),
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
          },
          (chunk: string) => {
            if (!streamedText) {
              useChatStore.getState().setSendState(characterId, 'streaming');
            }
            streamedText += chunk;
            useChatStore.getState().updateChatThread(characterId, (thread) => {
              const msgs = thread.messages.map(m =>
                m.id === aiPlaceholderId ? { ...m, text: streamedText } : m,
              );
              return { ...thread, messages: msgs };
            });
          },
          () => {
            const finalMessages = [
              ...updatedThreadMessages,
              { ...aiPlaceholder, text: streamedText || '……发生连接断裂。' },
            ];
            chatApi.saveChat(characterId, toStoredChatMessages(chatCharacter, finalMessages)).catch(() => {});
            cacheMessages(characterId, [
              ...updatedThreadMessages,
              { ...aiPlaceholder, text: streamedText || '' },
            ]);
            useChatStore.getState().setSendState(characterId, 'idle');
            resolve();
          },
          (err: Error) => {
            const message = err.message || '消息发送失败';
            showToast(`消息发送失败: ${message}`, 'error');
            const errorMsg: ChatMessage = {
              id: 'msg_err_' + Date.now(),
              role: 'model',
              text: `（发送失败：${message}）`,
              timestamp: new Date().toISOString(),
            };
            const store = useChatStore.getState();
            store.setChatThreads({
              ...store.chatThreads,
              [characterId]: {
                ...store.chatThreads[characterId],
                messages: [...updatedThreadMessages, errorMsg],
              },
            });
            useChatStore.getState().setSendState(characterId, 'error');
            reject(err);
          },
          abortController.signal,
        );
      });
    } catch {
      useChatStore.getState().setSendState(characterId, 'error');
    }
  }, [chatApi, showToast]);

  // ── Stop generation ──
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
      const chatChar = charStore.characters.find(c => c.id === characterId) || charStore.characters[0];
      if (chatChar) {
        chatApi.saveChat(characterId, toStoredChatMessages(chatChar, msgs)).catch(() => {});
        cacheMessages(characterId, msgs);
      }
    }
    store.setSendState(characterId, 'idle');
  }, [chatApi]);

  // ── Edit message ──
  const handleEditMessage = useCallback((characterId: string, messageId: string, newText: string) => {
    const store = useChatStore.getState();
    const thread = store.chatThreads[characterId];
    if (!thread) return;
    const msgIdx = thread.messages.findIndex(m => m.id === messageId);
    if (msgIdx === -1) return;
    const updatedMessages = thread.messages.slice(0, msgIdx + 1).map(m =>
      m.id === messageId ? { ...m, text: newText } : m
    );
    store.updateChatThread(characterId, () => ({ ...thread, messages: updatedMessages }));
    queueMicrotask(() => {
      handleSendMessage(characterId, newText);
    });
  }, [handleSendMessage]);

  // ── Delete message ──
  const handleDeleteMessage = useCallback((characterId: string, messageId: string) => {
    const chatStore = useChatStore.getState();
    const thread = chatStore.chatThreads[characterId];
    if (!thread) return;
    const newMessages = thread.messages.filter(m => m.id !== messageId);
    chatStore.updateChatThread(characterId, () => ({
      ...thread,
      messages: newMessages,
    }));
    const charStore = useCharacterStore.getState();
    const chatChar = charStore.characters.find(c => c.id === characterId) || charStore.characters[0];
    if (chatChar) {
      chatApi.saveChat(characterId, toStoredChatMessages(chatChar, newMessages)).catch(() => {});
      cacheMessages(characterId, newMessages);
    }
  }, [chatApi]);

  // ── Chat thread loading (anonymous) ──
  useEffect(() => {
    if (!isFetched || currentUser) return;
    chatApi.getThreads()
      .then(data => {
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
      getCachedThreads().then(cached => {
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
  const loadedChats = useChatStore(s => s.loadedChats);
  useEffect(() => {
    if (currentScreen !== ScreenId.CHAT || !activeCharacterId) return;
    if (loadedChats.has(activeCharacterId)) return;
    markLoaded(activeCharacterId);
    chatApi.getChat(activeCharacterId)
      .then(data => {
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
        getCachedMessages(activeCharacterId).then(cached => {
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
  }, [activeCharacterId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  };
}
