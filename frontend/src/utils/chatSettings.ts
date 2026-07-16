/**
 * 聊天偏好（本地持久化）
 * - 模型选择
 * - 回复长度 / 温度
 * - 用户称呼 {{user}}
 * - 导演词强度
 */

export type ResponseLength = 'short' | 'medium' | 'long';
/** light=尊重角色卡；standard=默认；strict=强约束输出结构 */
export type PromptStrictness = 'light' | 'standard' | 'strict';

export interface ChatSettings {
  providerId: string | null;
  responseLength: ResponseLength;
  temperature: number;
  userName: string;
  promptStrictness: PromptStrictness;
}

// v3：增加 promptStrictness
const STORAGE_KEY = 'simpletavern_chat_settings_v3';
const LEGACY_KEY = 'simpletavern_chat_settings_v2';

const DEFAULTS: ChatSettings = {
  providerId: null,
  responseLength: 'medium',
  temperature: 0.92,
  userName: '',
  promptStrictness: 'standard',
};

function parseSettings(raw: string | null): ChatSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw) as Partial<ChatSettings>;
    const strict = parsed.promptStrictness;
    return {
      providerId: parsed.providerId ?? null,
      responseLength: (parsed.responseLength as ResponseLength) || 'medium',
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.9,
      userName: typeof parsed.userName === 'string' ? parsed.userName : '',
      promptStrictness:
        strict === 'light' || strict === 'standard' || strict === 'strict'
          ? strict
          : 'standard',
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function loadChatSettings(): ChatSettings {
  try {
    const v3 = localStorage.getItem(STORAGE_KEY);
    if (v3) return parseSettings(v3);
    // 迁移 v2（直接写 v3，避免 save 再 load 递归）
    const v2 = localStorage.getItem(LEGACY_KEY);
    if (v2) {
      const migrated = parseSettings(v2);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      } catch { /* ignore */ }
      return migrated;
    }
    return { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveChatSettings(partial: Partial<ChatSettings>): ChatSettings {
  const next = { ...loadChatSettings(), ...partial };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota errors
  }
  return next;
}

export function getEffectiveUserName(fallback?: string): string {
  const s = loadChatSettings();
  return s.userName.trim() || fallback?.trim() || '你';
}
