import { useState, useEffect, useCallback, useRef } from 'react';
import { type Character, type ChatMessage, type ChatThread } from '../types';
import { useToast } from '../components/Toast';
import { useChatApi } from '../api/chat';
import { useCharacterApi } from '../api/characters';
import { useCharacterStore } from '../stores/characterStore';
import { ScreenId } from '../types';
import { useChatStore, getActiveChatFileName, sessionLoadKey } from '../stores/chatStore';
import { useCurrentUser } from './useAuth';
import { toStoredChatMessages } from '../utils/chatMessages';
import { normalizeChatGetResponse } from '../utils/chatHistory';
import { cacheMessages, cacheThreads, getCachedMessages, getCachedThreads } from '../utils/chatCache';
import { getEffectiveUserName, loadChatSettings } from '../utils/chatSettings';

const PAGE_SIZE = 50;

function saveThread(
  chatApi: ReturnType<typeof useChatApi>,
  characterId: string,
  character: Character,
  messages: ChatMessage[],
  userName: string,
) {
  const fileName = getActiveChatFileName(characterId);
  return chatApi.saveChat(
    characterId,
    toStoredChatMessages(character, messages, userName),
    fileName,
  );
}

type StreamMode = 'send' | 'regenerate' | 'edit' | 'continue';

const CONTINUE_PROMPT =
  '（系统提示：请从你上一条回复的中断处继续写完，不要重复已经写过的内容，直接接着往下写，并写完整。）';

/** 按 id 精确查找角色，禁止回落到 characters[0]（避免串戏） */
function findCharacterById(characterId: string): Character | undefined {
  const list = useCharacterStore.getState().characters;
  const norm = characterId.replace(/\.png$/i, '');
  return list.find((c) => c.id === characterId)
    || list.find((c) => c.id.replace(/\.png$/i, '') === norm);
}

function expandGreetingText(
  template: string,
  charName: string,
  userName: string,
): string {
  return template
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName);
}

export function useChatFlow(currentScreen: ScreenId | null) {
  const { showToast } = useToast();
  const chatApi = useChatApi();
  const characterApi = useCharacterApi();
  const { data: currentUser, isFetched } = useCurrentUser();

  /** 按角色隔离 AbortController，避免串会话 */
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  /** 用户主动停止：onError 不再二次改写 UI */
  const intentionalAbortRef = useRef<Set<string>>(new Set());
  const [activeCharacterId, setActiveCharacterId] = useState<string>('yuki');

  // 不在 App 层订阅 chatThreads/sendingStates，避免流式更新全局重渲染
  const updateChatThread = useChatStore((s) => s.updateChatThread);
  const deleteChatThreads = useChatStore((s) => s.deleteChatThreads);
  const markLoaded = useChatStore((s) => s.markLoaded);

  const clearUnreadCount = useCallback((characterId: string) => {
    const store = useChatStore.getState();
    if (store.chatThreads[characterId]) {
      store.updateChatThread(characterId, (prev) => ({ ...prev, unreadCount: 0 }));
    }
  }, []);

  const resolveUserName = useCallback(() => {
    return getEffectiveUserName(
      (currentUser as { handle?: string; name?: string } | undefined)?.handle
      || (currentUser as { handle?: string; name?: string } | undefined)?.name,
    );
  }, [currentUser]);

  /**
   * 空会话写入 first_mes 为真实消息（可持久化），避免「看见又消失」
   */
  const seedGreetingIfEmpty = useCallback((
    characterId: string,
    chatChar: Character,
    existingMessages: ChatMessage[],
  ): ChatMessage[] => {
    if (existingMessages.length > 0) return existingMessages;
    const template = chatChar.first_mes || chatChar.tagline;
    if (!template?.trim()) return existingMessages;

    const userName = resolveUserName();
    const text = expandGreetingText(template, chatChar.name, userName);
    const greeting: ChatMessage = {
      id: 'msg_greet_' + Date.now(),
      role: 'model',
      text,
      timestamp: new Date().toISOString(),
    };
    const messages = [greeting];
    useChatStore.getState().updateChatThread(characterId, (prev) => ({
      ...prev,
      characterId,
      messages,
      unreadCount: 0,
      lastMessageText: text,
    }));
    saveThread(chatApi, characterId, chatChar, messages, userName).catch(() => {});
    cacheMessages(sessionLoadKey(characterId), messages);
    return messages;
  }, [chatApi, resolveUserName]);

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
      /** send 模式下要展示的 user 消息；regenerate/edit/continue 按需 */
      displayUserMsg: ChatMessage | null;
      /**
       * continue：把未完成的 AI 条放进 history 发给模型，UI 上从该条继续追加文本
       * 不新建占位气泡
       */
      continueFromMsgId?: string;
    },
  ) => {
    const chatStore = useChatStore.getState();

    const curState = chatStore.sendingStates[characterId] || 'idle';
    if (curState === 'sending' || curState === 'streaming') {
      showToast('AI 正在回复中，请等待回复完成后再发送', 'info');
      return;
    }

    const chatCharacter = findCharacterById(characterId);
    if (!chatCharacter) {
      showToast('角色不存在或尚未加载，请返回后重试', 'error');
      return;
    }

    const isContinue = opts.mode === 'continue' && Boolean(opts.continueFromMsgId);
    const continueId = opts.continueFromMsgId || '';

    const baseMessages = opts.displayUserMsg
      ? [...opts.historyMessages, opts.displayUserMsg]
      : [...opts.historyMessages];

    // continue：沿用已有 AI 气泡；其它模式新建占位
    const existingPartial = isContinue
      ? baseMessages.find((m) => m.id === continueId)?.text || ''
      : '';
    const aiPlaceholderId = isContinue ? continueId : 'msg_ai_' + Date.now();
    const aiPlaceholder: ChatMessage = {
      id: aiPlaceholderId,
      role: 'model',
      text: existingPartial,
      timestamp: new Date().toISOString(),
      truncated: false,
    };

    const currentThread = chatStore.chatThreads[characterId] || {
      characterId,
      messages: [],
      unreadCount: 0,
    };

    const displayMessages = isContinue
      ? baseMessages.map((m) => (m.id === continueId ? { ...m, truncated: false } : m))
      : [...baseMessages, aiPlaceholder];

    chatStore.setChatThreads({
      ...chatStore.chatThreads,
      [characterId]: {
        ...currentThread,
        characterId,
        messages: displayMessages,
        unreadCount: 0,
      },
    });
    chatStore.setSendState(characterId, 'sending');
    intentionalAbortRef.current.delete(characterId);

    const settings = loadChatSettings();
    const userName = resolveUserName();
    let streamedText = existingPartial;

    // 发送前清洗污染消息（失败/中断占位不进模型上下文）
    // continue：history 含 partial AI，让模型接着写
    const historySource = isContinue
      ? baseMessages
      : opts.historyMessages;
    const cleanHistory = historySource
      .filter((m) => {
        const t = m.text || '';
        if (!t.trim()) return false;
        if (/发生连接断裂|发送失败|\[已中断\]|（发送失败/.test(t)) return false;
        return true;
      })
      .map((m) => ({ role: m.role, text: m.text }));

    // 历史已含角色消息时，禁止后端再注入 first_mes
    const historyHasGreeting = cleanHistory.some((m) => m.role === 'model');

    const abortController = new AbortController();
    abortControllersRef.current.set(characterId, abortController);

    // rAF 合批流式文本更新，降低 store 写入频率
    let rafId = 0;
    const flushStreamText = () => {
      rafId = 0;
      if (intentionalAbortRef.current.has(characterId)) return;
      useChatStore.getState().updateChatThread(characterId, (thread) => {
        const msgs = thread.messages.map((m) =>
          m.id === aiPlaceholderId ? { ...m, text: streamedText, truncated: false } : m,
        );
        return { ...thread, messages: msgs };
      });
    };
    const cancelRaf = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

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
            // 历史已有开场则不再让后端注入 first_mes
            includeFirstMes: historyHasGreeting || isContinue ? false : undefined,
            temperature: settings.temperature,
            responseLength: settings.responseLength,
            promptStrictness: settings.promptStrictness,
            continueMode: isContinue,
          },
          (chunk: string) => {
            if (intentionalAbortRef.current.has(characterId)) return;
            if (streamedText === existingPartial) {
              useChatStore.getState().setSendState(characterId, 'streaming');
            }
            streamedText += chunk;
            if (!rafId) {
              rafId = requestAnimationFrame(flushStreamText);
            }
          },
          (meta) => {
            cancelRaf();
            if (intentionalAbortRef.current.has(characterId)) {
              intentionalAbortRef.current.delete(characterId);
              abortControllersRef.current.delete(characterId);
              resolve();
              return;
            }
            flushStreamText();
            const truncated = meta?.finishReason === 'length';
            const finalAi: ChatMessage = {
              ...aiPlaceholder,
              text: streamedText || (isContinue ? existingPartial : '……发生连接断裂。'),
              truncated,
            };
            const finalMessages = isContinue
              ? baseMessages.map((m) => (m.id === continueId ? finalAi : m))
              : [...baseMessages, finalAi];
            saveThread(chatApi, characterId, chatCharacter, finalMessages, userName).catch(() => {});
            cacheMessages(sessionLoadKey(characterId), finalMessages);
            useChatStore.getState().updateChatThread(characterId, (prev) => ({
              ...prev,
              characterId,
              chatFile: getActiveChatFileName(characterId),
              messages: finalMessages,
              unreadCount: 0,
            }));
            useChatStore.getState().setSendState(characterId, 'idle');
            abortControllersRef.current.delete(characterId);
            resolve();
          },
          (err: Error) => {
            cancelRaf();
            const message = err.message || '消息发送失败';
            const isAbort = err.name === 'AbortError' || /abort/i.test(message);
            const intentional = intentionalAbortRef.current.has(characterId);
            intentionalAbortRef.current.delete(characterId);
            abortControllersRef.current.delete(characterId);

            // 主动停止：UI 已由 handleStopGeneration 处理，禁止二次改写
            if (intentional || isAbort) {
              useChatStore.getState().setSendState(characterId, 'idle');
              resolve();
              return;
            }

            showToast(`消息发送失败: ${message}`, 'error');
            const errorMsg: ChatMessage = {
              id: 'msg_err_' + Date.now(),
              role: 'model',
              text: streamedText
                ? streamedText + '\n[已中断]'
                : `（发送失败：${message}）`,
              timestamp: new Date().toISOString(),
            };
            const finalMessages = isContinue
              ? baseMessages.map((m) => (m.id === continueId
                ? { ...m, text: streamedText ? streamedText + '\n[已中断]' : `（发送失败：${message}）` }
                : m))
              : [...baseMessages, errorMsg];
            useChatStore.getState().updateChatThread(characterId, (prev) => ({
              ...prev,
              characterId,
              chatFile: getActiveChatFileName(characterId),
              messages: finalMessages,
              unreadCount: 0,
            }));
            if (streamedText) {
              saveThread(chatApi, characterId, chatCharacter, finalMessages, userName).catch(() => {});
              cacheMessages(sessionLoadKey(characterId), finalMessages);
            }
            useChatStore.getState().setSendState(characterId, 'error');
            reject(err);
          },
          abortController.signal,
        );
      });
    } catch (err) {
      if (!intentionalAbortRef.current.has(characterId)) {
        useChatStore.getState().setSendState(characterId, 'error');
      }
      // 向上抛出，供 ChatScreen 设置 lastError / 重试
      throw err;
    }
  }, [chatApi, showToast, resolveUserName]);

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

  // ── 停止生成（唯一 UI 终态 owner，避免与 onError 竞态）──
  const handleStopGeneration = useCallback((characterId: string) => {
    intentionalAbortRef.current.add(characterId);
    const ctrl = abortControllersRef.current.get(characterId);
    ctrl?.abort();
    abortControllersRef.current.delete(characterId);

    const store = useChatStore.getState();
    const thread = store.chatThreads[characterId];
    if (thread) {
      const msgs = thread.messages.map((m, i) => {
        if (i === thread.messages.length - 1 && m.role === 'model') {
          const t = m.text || '';
          if (t.includes('[已中断]')) return m;
          return { ...m, text: t ? t + '\n[已中断]' : '[已中断]' };
        }
        return m;
      });
      store.updateChatThread(characterId, () => ({ ...thread, messages: msgs }));
      const chatChar = findCharacterById(characterId);
      if (chatChar) {
        saveThread(chatApi, characterId, chatChar, msgs, resolveUserName()).catch(() => {});
        cacheMessages(sessionLoadKey(characterId), msgs);
      }
    }
    store.setSendState(characterId, 'idle');
  }, [chatApi, resolveUserName]);

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
    const chatChar = findCharacterById(characterId);
    if (chatChar) {
      saveThread(chatApi, characterId, chatChar, newMessages, resolveUserName()).catch(() => {});
      cacheMessages(sessionLoadKey(characterId), newMessages);
    }
  }, [chatApi, resolveUserName]);

  // ── 新对话：新建会话文件（旧会话保留，可在消息中心找回）──
  const handleNewChat = useCallback((characterId: string, greetingIndex?: number) => {
    const chatStore = useChatStore.getState();
    const chatChar = findCharacterById(characterId);
    const userName = resolveUserName();
    const newFile = `chat_${Date.now()}`;

    chatStore.setActiveChatFile(characterId, newFile);

    // 可选：把 alternate_greeting / first_mes 作为首条 AI 消息写入
    let messages: ChatMessage[] = [];
    if (chatChar) {
      const greets = [
        chatChar.first_mes,
        ...(chatChar.alternate_greetings || []),
      ].filter((g): g is string => Boolean(g?.trim()));
      const idx = typeof greetingIndex === 'number' && greetingIndex >= 0
        ? greetingIndex
        : 0;
      const pick = greets[idx] || greets[0];
      if (pick) {
        messages = [{
          id: 'msg_greet_' + Date.now(),
          role: 'model',
          text: expandGreetingText(pick, chatChar.name, userName),
          timestamp: new Date().toISOString(),
        }];
      }
    }

    const loadKey = sessionLoadKey(characterId, newFile);
    chatStore.updateChatThread(characterId, (prev) => ({
      ...prev,
      characterId,
      chatFile: newFile,
      messages,
      unreadCount: 0,
      lastMessageText: messages[0]?.text || '',
    }));
    chatStore.clearHistoryPage(loadKey);
    chatStore.setHistoryPage(loadKey, { hasMore: false, nextOffset: messages.length });
    chatStore.markLoaded(loadKey);

    if (chatChar) {
      chatApi.saveChat(characterId, toStoredChatMessages(chatChar, messages, userName), newFile).catch(() => {});
      cacheMessages(loadKey, messages);
    }
    showToast('已开始新会话（旧对话仍在消息中心）', 'success');
  }, [chatApi, showToast, resolveUserName]);

  /** 切换到指定会话文件并加载 */
  const handleSelectChatSession = useCallback((characterId: string, chatFile: string) => {
    const store = useChatStore.getState();
    store.setActiveChatFile(characterId, chatFile || 'chat');
    // 强制重新加载：清 loaded 标记
    const loadKey = sessionLoadKey(characterId, chatFile || 'chat');
    const nextLoaded = new Set(store.loadedChats);
    nextLoaded.delete(loadKey);
    // 直接清消息，等 effect 拉
    store.updateChatThread(characterId, (prev) => ({
      ...prev,
      characterId,
      chatFile: chatFile || 'chat',
      messages: [],
      unreadCount: 0,
    }));
    // 通过删除 loaded 触发重载：set loadedChats
    useChatStore.setState({ loadedChats: nextLoaded });
    setActiveCharacterId(characterId);
  }, []);

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

  // ── 加载更早的历史（上拉）──
  const handleLoadOlderMessages = useCallback(async (characterId: string) => {
    const store = useChatStore.getState();
    const fileName = getActiveChatFileName(characterId);
    const pageKey = sessionLoadKey(characterId, fileName);
    const meta = store.historyPage[pageKey] ?? store.historyPage[characterId];
    if (!meta?.hasMore || meta.loadingOlder) return;

    store.setHistoryPage(pageKey, { ...meta, loadingOlder: true });
    try {
      const data = await chatApi.getChat(characterId, {
        limit: PAGE_SIZE,
        offset: meta.nextOffset,
        fileName,
      });
      const page = normalizeChatGetResponse(data);
      if (page.messages.length === 0) {
        store.setHistoryPage(pageKey, { hasMore: false, nextOffset: meta.nextOffset, loadingOlder: false });
        return;
      }
      store.updateChatThread(characterId, (prev) => ({
        ...prev,
        characterId,
        chatFile: fileName,
        messages: [...page.messages, ...(prev.messages || [])],
      }));
      store.setHistoryPage(pageKey, {
        hasMore: page.hasMore,
        nextOffset: page.nextOffset,
        loadingOlder: false,
      });
    } catch {
      useChatStore.getState().setHistoryPage(pageKey, {
        ...meta,
        loadingOlder: false,
      });
    }
  }, [chatApi]);

  /** 因 max_tokens 截断时续写：接着最后一条 AI 气泡往后生成 */
  const handleContinueGeneration = useCallback(async (characterId: string) => {
    const thread = useChatStore.getState().chatThreads[characterId];
    if (!thread?.messages?.length) {
      showToast('没有可续写的回复', 'info');
      return;
    }
    const last = thread.messages[thread.messages.length - 1];
    if (last.role !== 'model' || !last.text?.trim()) {
      showToast('没有可续写的回复', 'info');
      return;
    }
    await runStream(characterId, {
      mode: 'continue',
      messageText: CONTINUE_PROMPT,
      historyMessages: thread.messages,
      displayUserMsg: null,
      continueFromMsgId: last.id,
    });
  }, [runStream, showToast]);

  /** 失败后重试：去掉尾部失败气泡，基于最后一条 user 再生成 */
  const handleRetryFailedSend = useCallback(async (characterId: string) => {
    const store = useChatStore.getState();
    const thread = store.chatThreads[characterId];
    if (!thread) return;

    let msgs = [...thread.messages];
    while (
      msgs.length > 0
      && msgs[msgs.length - 1].role === 'model'
      && (/发送失败|\[已中断\]|发生连接断裂/.test(msgs[msgs.length - 1].text || '') || !msgs[msgs.length - 1].text?.trim())
    ) {
      msgs.pop();
    }

    let userIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) {
      showToast('没有可重试的消息', 'error');
      return;
    }

    const userMsg = msgs[userIdx];
    const historyBeforeUser = msgs.slice(0, userIdx);
    // 先同步去掉失败气泡
    store.updateChatThread(characterId, () => ({
      ...thread,
      messages: msgs,
    }));

    await runStream(characterId, {
      mode: 'regenerate',
      messageText: userMsg.text,
      historyMessages: historyBeforeUser,
      displayUserMsg: userMsg,
    });
  }, [runStream, showToast]);

  // ── Load chat history when entering chat ──
  const loadedChats = useChatStore((s) => s.loadedChats);
  const activeChatFile = useChatStore(
    (s) => s.activeChatFiles[activeCharacterId] || 'chat',
  );
  useEffect(() => {
    if (currentScreen !== ScreenId.CHAT || !activeCharacterId) return;
    const fileName = activeChatFile || 'chat';
    const loadKey = sessionLoadKey(activeCharacterId, fileName);

    if (loadedChats.has(loadKey)) {
      // 已加载但空会话：补种开场白
      const thread = useChatStore.getState().chatThreads[activeCharacterId];
      const chatChar = findCharacterById(activeCharacterId);
      if (chatChar && (!thread || thread.messages.length === 0)) {
        seedGreetingIfEmpty(activeCharacterId, chatChar, thread?.messages || []);
      }
      return;
    }
    markLoaded(loadKey);
    chatApi.getChat(activeCharacterId, { limit: PAGE_SIZE, offset: 0, fileName })
      .then((data) => {
        const page = normalizeChatGetResponse(data);
        const chatChar = findCharacterById(activeCharacterId);
        useChatStore.getState().setHistoryPage(loadKey, {
          hasMore: page.hasMore,
          nextOffset: page.nextOffset,
        });
        if (page.messages.length > 0) {
          useChatStore.getState().updateChatThread(activeCharacterId, (prev) => ({
            ...prev,
            characterId: activeCharacterId,
            chatFile: fileName,
            messages: page.messages,
            unreadCount: 0,
          }));
          cacheMessages(loadKey, page.messages);
        } else if (chatChar) {
          seedGreetingIfEmpty(activeCharacterId, chatChar, []);
        }
      })
      .catch(() => {
        getCachedMessages(loadKey).then((cached) => {
          const chatChar = findCharacterById(activeCharacterId);
          useChatStore.getState().setHistoryPage(loadKey, {
            hasMore: false,
            nextOffset: cached.length,
          });
          if (cached.length > 0) {
            useChatStore.getState().updateChatThread(activeCharacterId, (prev) => ({
              ...prev,
              characterId: activeCharacterId,
              chatFile: fileName,
              messages: cached,
              unreadCount: 0,
            }));
          } else if (chatChar) {
            seedGreetingIfEmpty(activeCharacterId, chatChar, []);
          }
        });
      });
  }, [activeCharacterId, activeChatFile, currentScreen, seedGreetingIfEmpty]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    activeCharacterId,
    setActiveCharacterId,
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
    handleSelectChatSession,
    handleLoadOlderMessages,
    handleRetryFailedSend,
    handleContinueGeneration,
  };
}
