import type { Character, ChatMessage } from '../types';

type StoredChatMessage = {
  id?: string;
  role?: string;
  text?: string;
  timestamp?: string;
  is_user?: boolean;
  mes?: string;
  send_date?: string;
  name?: string;
  character_name?: string;
};

function makeMessageId(prefix: string, index: number, text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return `${prefix}_${index}_${Math.abs(hash)}`;
}

export function fromStoredChatMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];

  return input.flatMap((item, index) => {
    const message = item as StoredChatMessage;
    const rawText = typeof message.text === 'string'
      ? message.text
      : typeof message.mes === 'string'
        ? message.mes
        : '';

    if (!rawText.trim()) return [];

    const role: ChatMessage['role'] =
      message.role === 'user' || message.is_user === true ? 'user' : 'model';

    return [{
      id: message.id || makeMessageId(role, index, rawText),
      role,
      text: rawText,
      timestamp: message.timestamp || message.send_date || '',
    }];
  });
}

export function toStoredChatMessages(
  character: Character,
  messages: ChatMessage[],
  userName = 'You',
) {
  const now = new Date().toISOString();
  const displayUser = userName.trim() || 'You';
  const meta = {
    user_name: displayUser,
    character_name: character.name,
    create_date: now,
    chat_metadata: {},
  };

  return [
    meta,
    ...messages.map((message) => {
      const isUser = message.role === 'user';
      return {
        name: isUser ? displayUser : character.name,
        is_user: isUser,
        mes: message.text,
        send_date: message.timestamp || now,
      };
    }),
  ];
}
