/**
 * Prompt 上下文编译器单元测试
 */

import { describe, it, expect } from 'vitest';
import {
    applyMacros,
    parseMesExample,
    selectLoreEntries,
    selectLoreItems,
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
    synthesizeFirstMes,
    inferRelationshipHint,
    applyContextBudget,
} from '../modules/backends/chat-completions/prompt-builder.js';
import type { ChatMessage } from '../modules/backends/types.js';

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

describe('normalizeCard / thin card / synthesize', () => {
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

    it('无 first_mes 时合成开场', () => {
        const card = normalizeCard({
            message: 'hi',
            history: [],
            characterName: '雪晴',
            characterDescription: '二十八岁温柔的人妻，白天是职场OL，对老公既依赖又有背德幻想。',
            userName: '达叔',
        });
        expect(card.firstMesSynthesized).toBe(true);
        expect(card.firstMes).toContain('达叔');
        expect(card.relationshipHint).toMatch(/达叔|婚姻|亲密/);
    });

    it('新会话注入合成 first_mes', () => {
        const { debug } = buildMessagesWithDebug({
            message: '你好',
            history: [],
            characterName: '测试角色',
            characterDescription: '一位话不多的旅人，性格冷静，习惯观察对方。',
            userName: 'Linda',
        });
        expect(debug.firstMesInjected).toBe(true);
        expect(debug.firstMesSynthesized).toBe(true);
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
        expect(debug.loreCount).toBeGreaterThanOrEqual(1);
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

    it('compact 本地 max_tokens 合理', () => {
        expect(resolveMaxTokens('medium', true)).toBe(1024);
        expect(resolveMaxTokens('long', true)).toBe(1536);
    });

    it('温度默认', () => {
        expect(resolveTemperature(undefined)).toBe(0.92);
        expect(resolveTemperature(0.5)).toBe(0.5);
    });
});

describe('synthesizeFirstMes / relationship', () => {
    it('合成开场含用户名', () => {
        const s = synthesizeFirstMes('柚姬', 'Linda', '黑客少女');
        expect(s).toContain('Linda');
        expect(s).toContain('柚姬');
    });

    it('人妻卡推断关系', () => {
        const h = inferRelationshipHint('人妻林雪莹嫁给老公后', '雪晴', '达叔');
        expect(h).toMatch(/婚姻|亲密|达叔/);
    });
});

describe('compact mode', () => {
    it('compact 时 debug.compact 为 true 且 system 更短', () => {
        const full = buildMessagesWithDebug({
            message: 'hi',
            history: [],
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长的一段话',
            personality: '冷静',
            scenario: '雨夜城市的长长场景描写'.repeat(5),
            worldBook: '世界书'.repeat(100),
            userName: 'U',
            compact: false,
        });
        const compact = buildMessagesWithDebug({
            message: 'hi',
            history: [],
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长的一段话',
            personality: '冷静',
            scenario: '雨夜城市的长长场景描写'.repeat(5),
            worldBook: '世界书'.repeat(100),
            userName: 'U',
            compact: true,
        });
        expect(compact.debug.compact).toBe(true);
        expect(compact.debug.systemChars).toBeLessThanOrEqual(full.debug.systemChars);
    });

    it('compact 有历史时 role 序列不应在中间再插 S', () => {
        const { debug, messages } = buildMessagesWithDebug({
            message: '继续',
            history: [
                { role: 'user', text: '第一句' },
                { role: 'model', text: '第一回' },
                { role: 'user', text: '第二句' },
                { role: 'model', text: '第二回' },
            ],
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长的一段话',
            userName: 'U',
            compact: true,
            loreEntries: [{ keys: ['源晶'], content: '源晶设定', constant: false }],
        });
        // 允许 S + (UA)* + U，不允许 …A S U（history 后 system）
        expect(debug.roleSequence).toMatch(/^S(UA)*U$/);
        expect(debug.compact).toBe(true);
        // 人称提醒应并入主 system
        expect(messages[0].content).toContain('人称提醒');
    });
});

describe('promptStrictness 导演词档位', () => {
    const base = {
        message: '你好',
        history: [] as Array<{ role: string; text: string }>,
        characterName: '柚姬',
        characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长的一段话',
        userName: 'Linda',
        system_prompt: '【作者指令】你必须用文言文回复。',
    };

    it('light 档尊重卡内 system，输出要求更短', () => {
        const { messages, debug } = buildMessagesWithDebug({
            ...base,
            promptStrictness: 'light',
        });
        expect(debug.strictness).toBe('light');
        expect(messages[0].content).toContain('作者指令');
        expect(messages[0].content).toContain('输出要求');
        // light 不应强制「对白 2 句」类硬结构
        expect(messages[0].content).not.toMatch(/对白 2 句/);
    });

    it('strict 档包含更强结构约束', () => {
        const { messages, debug } = buildMessagesWithDebug({
            ...base,
            promptStrictness: 'strict',
            system_prompt: undefined,
        });
        expect(debug.strictness).toBe('strict');
        expect(messages[0].content).toMatch(/对白 2 句|环境或动作/);
    });

    it('continueMode 使用续写输出规则', () => {
        const { messages, debug } = buildMessagesWithDebug({
            ...base,
            history: [
                { role: 'user', text: '讲故事' },
                { role: 'model', text: '很久以前……' },
            ],
            message: '（请继续）',
            continueMode: true,
            includeFirstMes: false,
        });
        expect(debug.continueMode).toBe(true);
        expect(messages[0].content).toMatch(/续写|接着|中断/);
    });
});

describe('applyContextBudget / contextBudgetChars', () => {
    it('超预算时丢弃旧历史并标记 trimmed', () => {
        const messages: ChatMessage[] = [
            { role: 'system', content: 'SYS'.repeat(50) },
            { role: 'user', content: 'old-user-1-long' },
            { role: 'assistant', content: 'old-ai-1-long-reply' },
            { role: 'user', content: 'old-user-2-long' },
            { role: 'assistant', content: 'old-ai-2-long-reply' },
            { role: 'user', content: 'current' },
        ];
        const totalBefore = messages.reduce((n, m) => n + m.content.length, 0);
        const budget = 120;
        expect(totalBefore).toBeGreaterThan(budget);
        const { messages: out, trimmed, totalChars } = applyContextBudget(messages, budget);
        expect(trimmed).toBe(true);
        expect(totalChars).toBeLessThanOrEqual(budget + 80); // 裁剪后逼近预算
        // 最后一条 user 保留
        expect(out[out.length - 1].role).toBe('user');
        expect(out[out.length - 1].content).toBe('current');
        // 首 system 仍在
        expect(out[0].role).toBe('system');
    });

    it('预算充足时不裁剪', () => {
        const messages: ChatMessage[] = [
            { role: 'system', content: 'short' },
            { role: 'user', content: 'hi' },
        ];
        const r = applyContextBudget(messages, 10_000);
        expect(r.trimmed).toBe(false);
        expect(r.messages).toHaveLength(2);
    });

    it('buildMessagesWithDebug 极小 budget 会 budgetTrimmed', () => {
        const history = Array.from({ length: 20 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'model',
            text: `很长的历史消息内容填充用来触发预算裁剪编号${i}`.repeat(3),
        }));
        const { debug } = buildMessagesWithDebug({
            message: '现在',
            history,
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长',
            userName: 'B',
            contextBudgetChars: 800,
            summarizeAfterMessages: 100, // 不先摘要，直接靠 budget 裁
            keepRecentMessages: 20,
            maxHistoryMessages: 40,
        });
        expect(debug.budgetChars).toBe(800);
        expect(debug.budgetTrimmed).toBe(true);
        expect(debug.totalChars).toBeLessThanOrEqual(900);
    });
});

describe('lore depth / position', () => {
    it('selectLoreItems 支持 position before/after', () => {
        const items = selectLoreItems(
            [
                { keys: [], content: '前置常驻', constant: true, position: 'before' },
                { keys: ['源晶'], content: '后置触发', constant: false, position: 'after' },
            ],
            '我要源晶',
            12,
            2500,
        );
        expect(items.some((i) => i.position === 'before' && i.content.includes('前置'))).toBe(true);
        expect(items.some((i) => i.position === 'after' && i.content.includes('后置'))).toBe(true);
    });

    it('depth 限制关键词扫描范围', () => {
        // 源晶只出现在很早的历史；depth=2 扫不到
        const historyTexts = [
            '第一句提到源晶',
            '第二句无关',
            '第三句无关',
            '第四句无关',
        ];
        const deepMiss = selectLoreItems(
            [{ keys: ['源晶'], content: '源晶设定', constant: false, depth: 2 }],
            historyTexts.join('\n') + '\n当前',
            12,
            2500,
            { historyTexts, currentMessage: '当前', defaultDepth: 0 },
        );
        expect(deepMiss.some((i) => i.content.includes('源晶设定'))).toBe(false);

        const deepHit = selectLoreItems(
            [{ keys: ['源晶'], content: '源晶设定', constant: false, depth: 10 }],
            historyTexts.join('\n') + '\n当前',
            12,
            2500,
            { historyTexts, currentMessage: '当前', defaultDepth: 0 },
        );
        expect(deepHit.some((i) => i.content.includes('源晶设定'))).toBe(true);
    });

    it('normalizeCharacterBook 解析 depth/position', () => {
        const lore = normalizeCharacterBook({
            entries: [
                { keys: ['a'], content: 'A', depth: 4, position: 'before_char' },
                { key: ['b'], content: 'B', position: 1 },
            ],
        });
        expect(lore[0].depth).toBe(4);
        expect(lore[0].position).toBe('before');
        expect(lore[1].position).toBe('after');
    });

    it('before lore 进入主 system，after 进入后置 system', () => {
        const { messages, debug } = buildMessagesWithDebug({
            message: '触发词 源晶',
            history: [{ role: 'user', text: 'hi' }, { role: 'model', text: 'yo' }],
            characterName: 'A',
            characterDescription: '详细角色描述超过八十字以确保不是 thin card 的简单兜底路径测试内容填充足够长',
            userName: 'U',
            loreEntries: [
                { keys: [], content: 'BEFORE_LORE_XYZ', constant: true, position: 'before' },
                { keys: ['源晶'], content: 'AFTER_LORE_XYZ', constant: false, position: 'after' },
            ],
        });
        expect(debug.loreBefore).toBeGreaterThanOrEqual(1);
        expect(debug.loreAfter).toBeGreaterThanOrEqual(1);
        expect(messages[0].content).toContain('BEFORE_LORE_XYZ');
        const post = messages.filter((m) => m.role === 'system').slice(1).map((m) => m.content).join('\n');
        expect(post).toContain('AFTER_LORE_XYZ');
    });
});
