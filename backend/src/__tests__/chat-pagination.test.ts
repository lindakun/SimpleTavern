/**
 * 聊天分页与多会话文件相关单测
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    readChatFilePage,
    listChatFiles,
    writeChatFile,
    getChatFilePath,
} from '../modules/chats/chats.repository.js';
import { getChatDataPage } from '../modules/chats/chats.service.js';
import type { Chat } from '../modules/chats/types.js';

function makeChat(messageCount: number, charName = 'TestChar'): Chat {
    const header = {
        chat_metadata: {},
        user_name: 'User',
        character_name: charName,
    };
    const messages = Array.from({ length: messageCount }, (_, i) => ({
        name: i % 2 === 0 ? 'User' : charName,
        is_user: i % 2 === 0,
        send_date: new Date(2026, 0, 1, 0, 0, i).toISOString(),
        mes: `message-${i}`,
        extra: {},
    }));
    return [header, ...messages] as Chat;
}

describe('readChatFilePage', () => {
    let tmpDir: string;
    let filePath: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-page-'));
        filePath = path.join(tmpDir, 'chat.jsonl');
        writeChatFile(filePath, makeChat(30));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('从末尾取 limit 条并报告 hasMore', () => {
        const page = readChatFilePage(filePath, { limit: 10, offset: 0 });
        expect(page.totalMessages).toBe(30);
        expect(page.hasMore).toBe(true);
        expect(page.limit).toBe(10);
        expect(page.offset).toBe(0);
        // header + 10 messages
        expect(page.chat.length).toBe(11);
        const last = page.chat[page.chat.length - 1] as { mes?: string };
        expect(last.mes).toBe('message-29');
        const firstMsg = page.chat[1] as { mes?: string };
        expect(firstMsg.mes).toBe('message-20');
    });

    it('offset 翻页取更早消息', () => {
        const page = readChatFilePage(filePath, { limit: 10, offset: 10 });
        expect(page.hasMore).toBe(true);
        const firstMsg = page.chat[1] as { mes?: string };
        const lastMsg = page.chat[page.chat.length - 1] as { mes?: string };
        expect(firstMsg.mes).toBe('message-10');
        expect(lastMsg.mes).toBe('message-19');
    });

    it('最后一页 hasMore=false', () => {
        const page = readChatFilePage(filePath, { limit: 10, offset: 25 });
        expect(page.hasMore).toBe(false);
        // 30-25=5 条
        expect(page.chat.length).toBe(6); // header + 5
    });

    it('文件不存在返回空', () => {
        const page = readChatFilePage(path.join(tmpDir, 'nope.jsonl'), { limit: 10 });
        expect(page.totalMessages).toBe(0);
        expect(page.hasMore).toBe(false);
        expect(page.chat.length).toBe(1);
    });
});

describe('listChatFiles 多会话', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chat-list-'));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('列出全部 jsonl 并按 mtime 升序', async () => {
        const a = path.join(tmpDir, 'chat.jsonl');
        const b = path.join(tmpDir, 'chat_100.jsonl');
        const c = path.join(tmpDir, 'chat_200.jsonl');
        writeChatFile(a, makeChat(2, 'A'));
        // 保证 mtime 有序
        await new Promise((r) => setTimeout(r, 15));
        writeChatFile(b, makeChat(2, 'B'));
        await new Promise((r) => setTimeout(r, 15));
        writeChatFile(c, makeChat(2, 'C'));

        const files = listChatFiles(tmpDir);
        expect(files).toHaveLength(3);
        expect(files.every((f) => f.endsWith('.jsonl'))).toBe(true);
        // 末尾为最新
        expect(files[files.length - 1]).toBe('chat_200.jsonl');
    });

    it('忽略非 jsonl', () => {
        writeChatFile(path.join(tmpDir, 'chat.jsonl'), makeChat(1));
        fs.writeFileSync(path.join(tmpDir, 'notes.txt'), 'x');
        expect(listChatFiles(tmpDir)).toEqual(['chat.jsonl']);
    });
});

describe('getChatDataPage service', () => {
    let chatsDir: string;
    let charDir: string;

    beforeEach(() => {
        chatsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-chats-root-'));
        charDir = 'Hero';
        const filePath = getChatFilePath(chatsDir, charDir, 'chat');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        writeChatFile(filePath, makeChat(15, 'Hero'));
        // 第二会话
        const file2 = getChatFilePath(chatsDir, charDir, 'chat_999');
        writeChatFile(file2, makeChat(5, 'Hero'));
    });

    afterEach(() => {
        fs.rmSync(chatsDir, { recursive: true, force: true });
    });

    it('分页读取默认会话', () => {
        const page = getChatDataPage(chatsDir, charDir, 'chat', { limit: 5, offset: 0 });
        expect(page.totalMessages).toBe(15);
        expect(page.hasMore).toBe(true);
        expect(page.chat.length).toBe(6);
    });

    it('读取独立会话文件', () => {
        const page = getChatDataPage(chatsDir, charDir, 'chat_999', { limit: 50, offset: 0 });
        expect(page.totalMessages).toBe(5);
        expect(page.hasMore).toBe(false);
    });

    it('同角色目录下有多个会话文件', () => {
        const dir = path.join(chatsDir, charDir);
        const files = listChatFiles(dir);
        expect(files.length).toBe(2);
        expect(files.some((f) => f.startsWith('chat'))).toBe(true);
        expect(files.some((f) => f.includes('999'))).toBe(true);
    });
});
