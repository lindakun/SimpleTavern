/**
 * 聊天类型测试
 */

import { describe, it, expect } from 'vitest';
import type { Chat, ChatHeader, ChatMessage } from '../modules/chats/types.js';

describe('Chat 类型', () => {
    it('应该创建有效的 Chat 数组', () => {
        const header: ChatHeader = {
            chat_metadata: { integrity: 'test' },
            user_name: 'User',
            character_name: 'Assistant',
        };

        const message: ChatMessage = {
            name: 'User',
            is_user: true,
            send_date: '2026-06-13',
            mes: 'Hello',
            extra: {},
        };

        const chat: Chat = [header, message];
        expect(chat[0]).toEqual(header);
        expect(chat[1]).toEqual(message);
        expect(chat.length).toBe(2);
    });

    it('应该支持多条消息', () => {
        const header: ChatHeader = {
            chat_metadata: {},
            user_name: 'User',
            character_name: 'Bot',
        };

        const messages: ChatMessage[] = [
            { name: 'User', is_user: true, send_date: '2026-06-13', mes: 'Hi', extra: {} },
            { name: 'Bot', is_user: false, send_date: '2026-06-13', mes: 'Hello!', extra: {} },
        ];

        const chat: Chat = [header, ...messages];
        expect(chat.length).toBe(3);
    });

    it('应该支持可选字段', () => {
        const message: ChatMessage = {
            name: 'User',
            is_user: true,
            send_date: '2026-06-13',
            mes: 'Test',
            extra: {},
            is_name: true,
            swipes: ['swipe1', 'swipe2'],
            swipe_id: 0,
        };

        expect(message.is_name).toBe(true);
        expect(message.swipes).toHaveLength(2);
        expect(message.swipe_id).toBe(0);
    });
});
