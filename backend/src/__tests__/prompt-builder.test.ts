/**
 * Prompt 上下文编译器单元测试
 */

import { describe, it, expect } from 'vitest';
import {
    applyMacros,
    parseMesExample,
    selectLoreEntries,
    normalizeCharacterBook,
    buildMessages,
    buildMessagesWithDebug,
    resolveMaxTokens,
    resolveTemperature,
    sanitizeText,
    cleanHistory,
    summarizeHistoryHeuristic,
    formatExampleForSystem,
    isPollutedMessage,
    applyHistoryWindow,
    normalizeCard,
} from '../modules/backends/chat-completions/prompt-builder.js';

describe('sanitizeText', () => {
    it('替换数学尖括号', () => {
        expect(sanitizeText('⟨hello⟩')).toBe('<hello>');
        expect(sanitizeText('⟪a⟫⟦b⟧')).toBe('<<a>>[b]');
    });
});

describe('applyMacros', () => {
    it('替换 char/user 宏', () => {
        expect(applyMacros('你好 {{user}}，我是 {{char}}', '柚姬', 'Linda'))
            .toBe('你好 Linda，我是 柚姬');
    });

    it('大小写不敏感', () => {
        expect(applyMacros('{{CHAR}} and {{USER}}', 'A', 'B')).toBe('A and B');
    });
});

describe('parseMesExample / formatExampleForSystem', () => {
    it('解析 User/Char 格式示例', () => {
        const raw = `<START>
{{user}}: 你好
{{char}}: 哼，有事快说
<START>
{{user}}: 今天天气不错
{{char}}: 是吗……随便你怎么想
`;
        const msgs = parseMesExample(raw, '柚姬', '你');
        expect(msgs.length).toBeGreaterThanOrEqual(4);
        expect(msgs[0].role).toBe('user');
        expect(msgs[1].role).toBe('assistant');
        expect(msgs[1].content).toContain('有事快说');
    });

    it('文风示例进入 system 而非对话历史', () => {
        const ex = formatExampleForSystem(
            `<START>\n{{user}}: hi\n{{char}}: 哼\n`,
            '柚姬',
            'Linda',
        );
        expect(ex).toContain('Linda');
        expect(ex).toContain('哼');

        const { messages, debug } = buildMessagesWithDebug({
            message: '继续',
            history: [{ role: 'user', text: '第一句' }, { role: 'model', text: '第一回' }],
            characterName: '柚姬',
            characterDescription: '毒舌黑客，精通网络入侵',
            mes_example: `<START>\n{{user}}: hi\n{{char}}: 哼\n`,
            userName: 'Linda',
        });
        expect(debug.exampleInSystem).toBe(true);
        // 示例不应变成独立 user/assistant 夹在历史前导致 role 序列污染
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toContain('文风示例');
        // 有历史时不注入 first_mes
        expect(debug.firstMesInjected).toBe(false);
    });
});

describe('selectLoreEntries', () => {
    const entries = [
        { keys: [], content: '常驻设定：雨夜新京', constant: true },
        { keys: ['源晶'], content: '源晶是能量货币', constant: false },
        { keys: ['猫耳'], content: '角色有猫耳', constant: false },
        { keys: ['禁用'], content: '不应出现', enabled: false },
    ];

    it('注入 constant 条目', () => {
        const selected = selectLoreEntries(entries, '你好');
        expect(selected.some((s) => s.includes('雨夜新京'))).toBe(true);
    });

    it('按关键词触发', () => {
        const selected = selectLoreEntries(entries, '我要买源晶');
        expect(selected.some((s) => s.includes('能量货币'))).toBe(true);
        expect(selected.some((s) => s.includes('猫耳'))).toBe(false);
    });

    it('跳过 disabled', () => {
        const selected = selectLoreEntries(entries, '禁用 触发');
        expect(selected.some((s) => s.includes('不应出现'))).toBe(false);
    });

    it('遵守字符预算', () => {
        const big = [
            { keys: [], content: 'A'.repeat(100), constant: true },
            { keys: ['x'], content: 'B'.repeat(100), constant: false },
        ];
        const selected = selectLoreEntries(big, 'x x x', 12, 120);
        const total = selected.join('').length;
        expect(total).toBeLessThanOrEqual(120 + 5);
    });
});

describe('normalizeCharacterBook', () => {
    it('支持数组 entries', () => {
        const book = {
            entries: [
                { keys: ['a'], content: 'A', constant: true, enabled: true },
            ],
        };
        const lore = normalizeCharacterBook(book);
        expect(lore).toHaveLength(1);
        expect(lore[0].content).toBe('A');
    });

    it('支持对象 entries（世界书格式）', () => {
        const book = {
            entries: {
                '1': { key: ['刀'], content: '武士之刀', disable: false, order: 1 },
            },
        };
        const lore = normalizeCharacterBook(book);
        expect(lore).toHaveLength(1);
        expect(lore[0].keys).toContain('刀');
    });
});

describe('history policy', () => {
    it('识别污染消息', () => {
        expect(isPollutedMessage('……发生连接断裂。')).toBe(true);
        expect(isPollutedMessage('（发送失败：fetch failed）')).toBe(true);
        expect(isPollutedMessage('你好呀')).toBe(false);
    });

    it('清洗历史', () => {
        const cleaned = cleanHistory([
            { role: 'user', text: 'hi' },
            { role: 'model', text: '……发生连接断裂。' },
            { role: 'user', text: 'hi' },
            { role: 'user', text: 'hi' },
            { role: 'model', text: 'ok' },
        ]);
        expect(cleaned).toEqual([
            { role: 'user', text: 'hi' },
            { role: 'model', text: 'ok' },
        ]);
    });

    it('长历史触发摘要', () => {
        const history = Array.from({ length: 24 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'model',
            text: `msg${i} 内容若干`,
        }));
        const win = applyHistoryWindow(history, {
            summarizeAfterMessages: 10,
            keepRecentMessages: 6,
            charName: 'A',
            userName: 'B',
        });
        expect(win.summarized).toBe(true);
        expect(win.summary).toContain('前情摘要');
        expect(win.history.length).toBe(6);
    });

    it('启发式摘要有内容', () => {
        const s = summarizeHistoryHeuristic(
            [
                { role: 'user', text: '我叫小明' },
                { role: 'model', text: '记住了' },
            ],
            '角色',
            '用户',
        );
        expect(s).toContain('小明');
    });
});

describe('normalizeCard / thin card', () => {
    it('空卡标记 thin 并补兜底', () => {
        const card = normalizeCard({
            message: 'hi',
            history: [],
            characterName: '雪晴',
            characterDescription: '短',
            userName: '你',
        });
        expect(card.thinCard).toBe(true);
        expect(card.personality.length).toBeGreaterThan(0);
    });
});

describe('buildMessages', () => {
    it('包含中文 system 与当前 user', () => {
        const msgs = buildMessages({
            message: '你好',
            history: [],
            characterName: '柚姬',
            characterDescription: '毒舌黑客，精通神经网络',
            userName: 'Linda',
        });
        expect(msgs[0].role).toBe('system');
        expect(msgs[0].content).toMatch(/角色扮演|柚姬/);
        expect(msgs[0].content).not.toMatch(/avoid walls of text/i);
        expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: '你好' });
    });

    it('新会话注入 first_mes，有历史不注入', () => {
        const fresh = buildMessagesWithDebug({
            message: 'hi',
            history: [],
            characterName: '柚姬',
            characterDescription: '黑客角色，性格傲娇毒舌很有个性',
            first_mes: '哼，{{user}}来了？',
            userName: 'Linda',
        });
        expect(fresh.debug.firstMesInjected).toBe(true);
        expect(fresh.messages.some((m) => m.role === 'assistant' && m.content.includes('Linda来了'))).toBe(true);

        const cont = buildMessagesWithDebug({
            message: '继续',
            history: [
                { role: 'user', text: '第一句' },
                { role: 'model', text: '第一回' },
            ],
            characterName: '柚姬',
            characterDescription: '黑客角色，性格傲娇毒舌很有个性',
            first_mes: '哼，开场白很长很长',
            userName: 'Linda',
        });
        expect(cont.debug.firstMesInjected).toBe(false);
    });

    it('lore 注入贴近末尾 system', () => {
        const { messages, debug } = buildMessagesWithDebug({
            message: '这源晶怎么用？',
            history: [],
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充',
            loreEntries: [
                { keys: ['源晶'], content: '源晶设定正文XYZ', constant: false },
            ],
            userName: 'U',
        });
        expect(debug.loreCount).toBe(1);
        // 最后一条是 user，倒数第二条应是含 lore 的 system
        expect(messages[messages.length - 1].role).toBe('user');
        const post = messages[messages.length - 2];
        expect(post.role).toBe('system');
        expect(post.content).toContain('源晶设定正文XYZ');
    });

    it('post_history 进入末段 system', () => {
        const msgs = buildMessages({
            message: 'x',
            history: [{ role: 'user', text: 'a' }, { role: 'model', text: 'b' }],
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长',
            post_history_instructions: '本轮必须提到雨',
            userName: 'U',
        });
        const joined = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
        expect(joined).toContain('本轮必须提到雨');
    });

    it('宏替换 description 中的 {{char}}', () => {
        const msgs = buildMessages({
            message: 'x',
            history: [],
            characterName: '柚姬',
            characterDescription: '{{char}} 是黑客，擅长入侵大公司主脑系统，性格毒舌',
            userName: 'U',
        });
        expect(msgs[0].content).toContain('柚姬 是黑客');
        expect(msgs[0].content).not.toContain('{{char}}');
    });

    it('长历史摘要后 roleSequence 合理', () => {
        const history = Array.from({ length: 22 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'model',
            text: `回合${i}`,
        }));
        const { debug } = buildMessagesWithDebug({
            message: '现在',
            history,
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长',
            userName: 'B',
            summarizeAfterMessages: 10,
            keepRecentMessages: 6,
        });
        expect(debug.summarized).toBe(true);
        expect(debug.historyOut).toBe(6);
        expect(debug.roleSequence.startsWith('S')).toBe(true);
        expect(debug.roleSequence.endsWith('U')).toBe(true);
    });
});

describe('resolveMaxTokens / resolveTemperature', () => {
    it('长度档位提高 medium 默认', () => {
        expect(resolveMaxTokens('short')).toBe(400);
        expect(resolveMaxTokens('medium')).toBe(1400);
        expect(resolveMaxTokens('long')).toBe(2048);
        expect(resolveMaxTokens(100)).toBe(100);
    });

    it('温度默认', () => {
        expect(resolveTemperature(undefined)).toBe(0.92);
        expect(resolveTemperature(0.5)).toBe(0.5);
    });
});
