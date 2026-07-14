/**
 * Prompt 构建器单元测试
 */

import { describe, it, expect } from 'vitest';
import {
    applyMacros,
    parseMesExample,
    selectLoreEntries,
    normalizeCharacterBook,
    buildMessages,
    resolveMaxTokens,
    resolveTemperature,
    sanitizeText,
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

describe('parseMesExample', () => {
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

    it('无法解析时降级为 system 旁注', () => {
        const msgs = parseMesExample('这是一整段没有角色标记的示例语气说明。', 'A', 'B');
        expect(msgs).toHaveLength(1);
        expect(msgs[0].role).toBe('system');
        expect(msgs[0].content).toContain('Example dialogue');
    });

    it('空字符串返回空数组', () => {
        expect(parseMesExample('', 'A', 'B')).toEqual([]);
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

describe('buildMessages', () => {
    it('包含 system + 当前 user 消息', () => {
        const msgs = buildMessages({
            message: '你好',
            history: [],
            characterName: '柚姬',
            characterDescription: '毒舌黑客',
            userName: 'Linda',
            includeFirstMes: false,
        });
        expect(msgs[0].role).toBe('system');
        expect(msgs[0].content).toContain('柚姬');
        expect(msgs[msgs.length - 1]).toEqual({ role: 'user', content: '你好' });
    });

    it('注入 first_mes 与 mes_example', () => {
        const msgs = buildMessages({
            message: '继续',
            history: [],
            characterName: '柚姬',
            characterDescription: 'desc',
            first_mes: '哼，{{user}}来了？',
            mes_example: `<START>
{{user}}: hi
{{char}}: 哼
`,
            userName: 'Linda',
            includeFirstMes: true,
        });
        const roles = msgs.map((m) => m.role);
        expect(roles).toContain('assistant');
        expect(msgs.some((m) => m.content.includes('Linda来了'))).toBe(true);
        expect(msgs.some((m) => m.role === 'user' && m.content === 'hi')).toBe(true);
    });

    it('注入匹配的 lore', () => {
        const msgs = buildMessages({
            message: '这源晶怎么用？',
            history: [],
            characterName: 'A',
            characterDescription: 'd',
            loreEntries: [
                { keys: ['源晶'], content: '源晶设定正文', constant: false },
            ],
            includeFirstMes: false,
        });
        expect(msgs[0].content).toContain('源晶设定正文');
    });

    it('截断过长历史', () => {
        const history = Array.from({ length: 40 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'model',
            text: `msg${i}`,
        }));
        const msgs = buildMessages({
            message: 'now',
            history,
            characterName: 'A',
            characterDescription: 'd',
            includeFirstMes: false,
            maxHistoryMessages: 10,
        });
        // system + 10 history + current user
        const histCount = msgs.filter((m) => m.role !== 'system' && m.content !== 'now').length;
        // last is current user "now"
        expect(msgs[msgs.length - 1].content).toBe('now');
        expect(histCount).toBe(10);
    });

    it('宏替换 description 中的 {{char}}', () => {
        const msgs = buildMessages({
            message: 'x',
            history: [],
            characterName: '柚姬',
            characterDescription: '{{char}} 是黑客',
            includeFirstMes: false,
        });
        expect(msgs[0].content).toContain('柚姬 是黑客');
        expect(msgs[0].content).not.toContain('{{char}}');
    });
});

describe('resolveMaxTokens / resolveTemperature', () => {
    it('长度档位', () => {
        expect(resolveMaxTokens('short')).toBe(256);
        expect(resolveMaxTokens('medium')).toBe(768);
        expect(resolveMaxTokens('long')).toBe(2048);
        expect(resolveMaxTokens(100)).toBe(100);
    });

    it('温度范围', () => {
        expect(resolveTemperature(undefined)).toBe(0.9);
        expect(resolveTemperature(0.5)).toBe(0.5);
        expect(resolveTemperature(9)).toBe(0.9);
    });
});
