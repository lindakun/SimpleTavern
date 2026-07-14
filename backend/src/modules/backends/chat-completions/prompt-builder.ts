/**
 * 角色扮演 Prompt 构建器
 * - 宏替换 {{char}} / {{user}}
 * - mes_example 示例对话注入
 * - Character Book / 世界书关键词触发
 * - 历史窗口截断
 */

import type { ChatMessage } from '../types.js';

/** 角色书 / 世界书条目（简化统一格式） */
export interface LoreEntry {
    keys: string[];
    secondary_keys?: string[];
    content: string;
    constant?: boolean;
    enabled?: boolean;
    selective?: boolean;
    insertion_order?: number;
}

export interface PromptBuildRequest {
    message: string;
    history: Array<{ role: string; text: string }>;
    characterName: string;
    characterDescription: string;
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    worldBook?: string;
    /** 角色内嵌 character_book / 解析后的世界书条目 */
    loreEntries?: LoreEntry[];
    /** 用户称呼，用于 {{user}} */
    userName?: string;
    /** 是否将 first_mes 注入为初始 assistant（默认 true；历史已含开场时可关） */
    includeFirstMes?: boolean;
    /** 历史消息上限（条） */
    maxHistoryMessages?: number;
}

/**
 * 清理易被 tokenizer 误解析的特殊 Unicode 字符
 */
export function sanitizeText(text: string): string {
    return text
        .replace(/⟨/g, '<')
        .replace(/⟩/g, '>')
        .replace(/⟪/g, '<<')
        .replace(/⟫/g, '>>')
        .replace(/⟦/g, '[')
        .replace(/⟧/g, ']');
}

/**
 * 替换 {{char}} / {{user}} 等宏
 */
export function applyMacros(text: string, charName: string, userName: string): string {
    if (!text) return text;
    return text
        .replace(/\{\{char\}\}/gi, charName)
        .replace(/\{\{user\}\}/gi, userName)
        .replace(/<CHAR>/gi, charName)
        .replace(/<USER>/gi, userName);
}

/**
 * 解析 mes_example 为对话对
 * 支持 SillyTavern 常见格式：
 * - <START> 分段
 * - {{user}}: / {{char}}: 行
 * - User: / Character: 行
 */
export function parseMesExample(
    mesExample: string,
    charName: string,
    userName: string,
): ChatMessage[] {
    if (!mesExample?.trim()) return [];

    const expanded = applyMacros(mesExample, charName, userName);
    // 按 <START> 分段，去掉空段
    const blocks = expanded
        .split(/<START>/i)
        .map((b) => b.trim())
        .filter(Boolean);

    const result: ChatMessage[] = [];
    // 宏已展开后，用实际名字匹配；同时兼容未展开的 {{user}}/{{char}}
    const lineRe = new RegExp(
        `^(?:\\{\\{user\\}\\}|User|USER|你|${escapeRegExp(userName)})\\s*[:：]\\s*(.+)$`,
        'i',
    );
    const charRe = new RegExp(
        `^(?:\\{\\{char\\}\\}|${escapeRegExp(charName)}|Character|CHAR|Assistant)\\s*[:：]\\s*(.+)$`,
        'i',
    );

    for (const block of blocks) {
        const lines = block.split(/\r?\n/);
        let currentRole: 'user' | 'assistant' | null = null;
        let currentText = '';

        const flush = () => {
            if (currentRole && currentText.trim()) {
                result.push({ role: currentRole, content: currentText.trim() });
            }
            currentRole = null;
            currentText = '';
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            const userMatch = line.match(lineRe);
            const charMatch = line.match(charRe);

            if (userMatch) {
                flush();
                currentRole = 'user';
                currentText = userMatch[1];
            } else if (charMatch) {
                flush();
                currentRole = 'assistant';
                currentText = charMatch[1];
            } else if (currentRole) {
                currentText += '\n' + line;
            }
        }
        flush();
    }

    // 若无法按行解析，整段作为 system 旁注
    if (result.length === 0 && expanded.trim()) {
        return [{
            role: 'system',
            content: `Example dialogue style:\n${expanded.trim()}`,
        }];
    }

    return result;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 根据近期文本匹配 lore 条目
 * - constant=true 且 enabled 的条目始终注入
 * - 其它条目：任一 key 出现在扫描文本中则注入
 */
export function selectLoreEntries(
    entries: LoreEntry[],
    scanText: string,
    maxEntries = 12,
): string[] {
    if (!entries?.length) return [];

    const text = scanText.toLowerCase();
    const sorted = [...entries]
        .filter((e) => e.enabled !== false && e.content?.trim())
        .sort((a, b) => (a.insertion_order ?? 0) - (b.insertion_order ?? 0));

    const selected: string[] = [];

    for (const entry of sorted) {
        if (selected.length >= maxEntries) break;

        if (entry.constant) {
            selected.push(entry.content.trim());
            continue;
        }

        const keys = (entry.keys || []).filter(Boolean);
        if (keys.length === 0) continue;

        const matched = keys.some((k) => text.includes(k.toLowerCase()));
        if (!matched) continue;

        // selective：若有 secondary_keys，至少命中一个 secondary
        if (entry.selective && entry.secondary_keys?.length) {
            const secOk = entry.secondary_keys.some((k) => text.includes(k.toLowerCase()));
            if (!secOk) continue;
        }

        selected.push(entry.content.trim());
    }

    return selected;
}

/**
 * 从 character_book 原始结构归一化为 LoreEntry[]
 */
export function normalizeCharacterBook(book: unknown): LoreEntry[] {
    if (!book || typeof book !== 'object') return [];
    const raw = book as { entries?: unknown };
    const entries = raw.entries;
    if (!entries) return [];

    const list: unknown[] = Array.isArray(entries)
        ? entries
        : typeof entries === 'object'
            ? Object.values(entries as Record<string, unknown>)
            : [];

    return list.map((item) => {
        const e = item as Record<string, unknown>;
        const keys = Array.isArray(e.keys)
            ? (e.keys as string[])
            : Array.isArray(e.key)
                ? (e.key as string[])
                : [];
        const secondary = Array.isArray(e.secondary_keys)
            ? (e.secondary_keys as string[])
            : Array.isArray(e.keysecondary)
                ? (e.keysecondary as string[])
                : [];
        return {
            keys,
            secondary_keys: secondary,
            content: String(e.content || ''),
            constant: Boolean(e.constant),
            enabled: e.enabled !== false && e.disable !== true,
            selective: Boolean(e.selective),
            insertion_order: Number(e.insertion_order ?? e.order ?? 0),
        };
    });
}

/**
 * 构建发给 LLM 的消息列表
 */
export function buildMessages(req: PromptBuildRequest): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const charName = req.characterName || 'Character';
    const userName = req.userName || 'User';
    const macro = (t: string) => applyMacros(t, charName, userName);

    // ── System prompt ──
    let systemPrompt: string;
    if (req.system_prompt?.trim()) {
        systemPrompt = macro(req.system_prompt);
    } else {
        systemPrompt = `You are roleplaying as a fictional character named "${charName}".`;
    }

    if (req.characterDescription?.trim()) {
        systemPrompt += `\n\nCharacter Description:\n${macro(req.characterDescription)}`;
    }
    if (req.personality?.trim()) {
        systemPrompt += `\n\nPersonality:\n${macro(req.personality)}`;
    }
    if (req.scenario?.trim()) {
        systemPrompt += `\n\nScenario:\n${macro(req.scenario)}`;
    }

    // 静态 worldBook 文本（兼容旧字段：可能是 lore 正文，也可能只是名称）
    if (req.worldBook?.trim() && req.worldBook.length > 40) {
        systemPrompt += `\n\nWorldbook / Lore:\n${macro(req.worldBook)}`;
    }

    // 扫描文本：近期历史 + 当前消息
    const historyTexts = (req.history || []).map((m) => m.text || '').join('\n');
    const scanText = `${historyTexts}\n${req.message || ''}`;

    const loreSnippets = selectLoreEntries(req.loreEntries || [], scanText);
    if (loreSnippets.length > 0) {
        systemPrompt += `\n\nRelevant Lore (World Info):\n${loreSnippets.map((s, i) => `[${i + 1}] ${macro(s)}`).join('\n\n')}`;
    }

    // 通用规则：始终附加简短约束（有自定义 system_prompt 时也加，避免出戏）
    systemPrompt += `\n\nCRITICAL RULES:
1. Always stay in character as ${charName}. Never speak as an AI assistant or break character.
2. Speak primarily in Chinese unless the character description specifies otherwise.
3. Keep responses natural and conversational; avoid walls of text unless the scene needs it.
4. Show the character's personality in tone, word choice, and actions.
5. Do not invent contradicting lore that conflicts with provided Character Description / Lore.`;

    messages.push({ role: 'system', content: sanitizeText(systemPrompt) });

    // ── mes_example few-shot ──
    if (req.mes_example?.trim()) {
        const examples = parseMesExample(req.mes_example, charName, userName);
        for (const ex of examples) {
            messages.push({ role: ex.role, content: sanitizeText(ex.content) });
        }
    }

    // ── first_mes 作为开场 assistant（仅在需要时）──
    const includeFirst = req.includeFirstMes !== false;
    if (includeFirst && req.first_mes?.trim()) {
        messages.push({
            role: 'assistant',
            content: sanitizeText(macro(req.first_mes)),
        });
    }

    // ── 历史 ──
    const maxHist = req.maxHistoryMessages ?? 30;
    if (req.history && req.history.length > 0) {
        const recent = req.history.length > maxHist
            ? req.history.slice(-maxHist)
            : req.history;

        for (const msg of recent) {
            const role = msg.role === 'user' ? 'user' : 'assistant';
            messages.push({
                role,
                content: sanitizeText(macro(msg.text || '')),
            });
        }
    }

    // ── post_history_instructions ──
    if (req.post_history_instructions?.trim()) {
        messages.push({
            role: 'system',
            content: sanitizeText(macro(req.post_history_instructions)),
        });
    }

    // ── 当前用户消息 ──
    messages.push({
        role: 'user',
        content: sanitizeText(macro(req.message || '')),
    });

    return messages;
}

/** 回复长度档位 → max_tokens */
export function resolveMaxTokens(length?: string | number): number {
    if (typeof length === 'number' && length > 0) return Math.min(length, 8192);
    switch (String(length || 'medium').toLowerCase()) {
        case 'short':
            return 256;
        case 'long':
            return 2048;
        case 'medium':
        default:
            return 768;
    }
}

export function resolveTemperature(temp?: number): number {
    if (typeof temp === 'number' && temp >= 0 && temp <= 2) return temp;
    return 0.9;
}
