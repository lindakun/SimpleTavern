/**
 * 聊天偏好（本地持久化）
 * - 模型选择
 * - 回复长度 / 温度
 * - 用户称呼 {{user}}
 */

export type ResponseLength = 'short' | 'medium' | 'long';

export interface ChatSettings {
  providerId: string | null;
  responseLength: ResponseLength;
  temperature: number;
  userName: string;
}

// v2：清除 v1 中错误自动写入的云端模型偏好（Docker 出网不可达时导致 fetch failed）
const STORAGE_KEY = 'simpletavern_chat_settings_v2';

const DEFAULTS: ChatSettings = {
  providerId: null,
  responseLength: 'medium',
  temperature: 0.92,
  userName: '',
};

export function loadChatSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<ChatSettings>;
    return {
      providerId: parsed.providerId ?? null,
      responseLength: (parsed.responseLength as ResponseLength) || 'medium',
      temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.9,
      userName: typeof parsed.userName === 'string' ? parsed.userName : '',
    };
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
