/**
 * 角色扮演 Prompt 上下文编译器
 *
 * 管线：
 * 1. 宏替换 / 卡片归一化（空卡兜底）
 * 2. 历史清洗 + 摘要
 * 3. 世界书选择（预算）
 * 4. 按固定 slot 组装 messages
 * 5. 产出 debug 统计
 */

import type { ChatMessage } from '../types.js';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

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
    /** 可选 tagline，用于合成开场 */
    tagline?: string;
    loreEntries?: LoreEntry[];
    userName?: string;
    /** 显式控制；默认仅在 history 为空时注入 first_mes */
    includeFirstMes?: boolean;
    maxHistoryMessages?: number;
    /** lore 总字符预算 */
    loreBudgetChars?: number;
    /** 摘要触发：历史条数超过此值则压缩早期消息 */
    summarizeAfterMessages?: number;
    /** 摘要后保留的近期原文条数 */
    keepRecentMessages?: number;
    /**
     * 紧凑模式（本地小模型）：缩短 system、略减 max 相关文案，降低延迟与跑偏
     */
    compact?: boolean;
}

export interface PromptBuildResult {
    messages: ChatMessage[];
    debug: PromptDebugInfo;
}

export interface PromptDebugInfo {
    charName: string;
    userName: string;
    thinCard: boolean;
    firstMesInjected: boolean;
    firstMesSynthesized: boolean;
    exampleInSystem: boolean;
    loreCount: number;
    loreChars: number;
    historyIn: number;
    historyOut: number;
    historyCleaned: number;
    summarized: boolean;
    summaryChars: number;
    systemChars: number;
    totalMessages: number;
    roleSequence: string;
    compact: boolean;
    slots: {
        system: number;
        postSystem: number;
        history: number;
        user: number;
    };
}

// ─────────────────────────────────────────────
// Sanitize & macros
// ─────────────────────────────────────────────

export function sanitizeText(text: string): string {
    return text
        .replace(/⟨/g, '<')
        .replace(/⟩/g, '>')
        .replace(/⟪/g, '<<')
        .replace(/⟫/g, '>>')
        .replace(/⟦/g, '[')
        .replace(/⟧/g, ']');
}

export function applyMacros(text: string, charName: string, userName: string): string {
    if (!text) return text;
    return text
        .replace(/\{\{char\}\}/gi, charName)
        .replace(/\{\{user\}\}/gi, userName)
        .replace(/<CHAR>/gi, charName)
        .replace(/<USER>/gi, userName);
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─────────────────────────────────────────────
// mes_example
// ─────────────────────────────────────────────

/**
 * 解析 mes_example 为对话对（供测试 / 可选 few-shot）
 */
export function parseMesExample(
    mesExample: string,
    charName: string,
    userName: string,
): ChatMessage[] {
    if (!mesExample?.trim()) return [];

    const expanded = applyMacros(mesExample, charName, userName);
    const blocks = expanded
        .split(/<START>/i)
        .map((b) => b.trim())
        .filter(Boolean);

    const result: ChatMessage[] = [];
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

    if (result.length === 0 && expanded.trim()) {
        return [{
            role: 'system',
            content: `文风示例:\n${expanded.trim()}`,
        }];
    }
    return result;
}

/**
 * 取 mes_example 中第一段有效示例，作为 system 内文风块（避免伪造成历史）
 */
export function formatExampleForSystem(
    mesExample: string,
    charName: string,
    userName: string,
    maxChars = 1200,
): string {
    if (!mesExample?.trim()) return '';
    const expanded = applyMacros(mesExample, charName, userName);
    const blocks = expanded
        .split(/<START>/i)
        .map((b) => b.trim())
        .filter(Boolean);
    let block = blocks[0] || expanded.trim();
    if (block.length > maxChars) {
        block = block.slice(0, maxChars) + '\n…';
    }
    return block;
}

// ─────────────────────────────────────────────
// Lore
// ─────────────────────────────────────────────

export function selectLoreEntries(
    entries: LoreEntry[],
    scanText: string,
    maxEntries = 12,
    budgetChars = 2500,
): string[] {
    if (!entries?.length) return [];

    const text = scanText.toLowerCase();
    const sorted = [...entries]
        .filter((e) => e.enabled !== false && e.content?.trim())
        .sort((a, b) => (a.insertion_order ?? 0) - (b.insertion_order ?? 0));

    const selected: string[] = [];
    let used = 0;

    const tryPush = (content: string) => {
        const c = content.trim();
        if (!c) return false;
        if (selected.length >= maxEntries) return false;
        if (used + c.length > budgetChars && selected.length > 0) return false;
        selected.push(c);
        used += c.length;
        return true;
    };

    // constant 优先
    for (const entry of sorted) {
        if (entry.constant) tryPush(entry.content);
    }

    for (const entry of sorted) {
        if (entry.constant) continue;
        const keys = (entry.keys || []).filter(Boolean);
        if (keys.length === 0) continue;
        const matched = keys.some((k) => text.includes(k.toLowerCase()));
        if (!matched) continue;
        if (entry.selective && entry.secondary_keys?.length) {
            const secOk = entry.secondary_keys.some((k) => text.includes(k.toLowerCase()));
            if (!secOk) continue;
        }
        tryPush(entry.content);
    }

    return selected;
}

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

// ─────────────────────────────────────────────
// History policy
// ─────────────────────────────────────────────

const POLLUTION_PATTERNS = [
    /发生连接断裂/,
    /发送失败/,
    /\[已中断\]/,
    /（发送失败[：:].+）/,
    /^\s*$/,
];

export function isPollutedMessage(text: string): boolean {
    const t = text || '';
    return POLLUTION_PATTERNS.some((re) => re.test(t));
}

export function cleanHistory(
    history: Array<{ role: string; text: string }>,
): Array<{ role: string; text: string }> {
    const cleaned: Array<{ role: string; text: string }> = [];
    for (const msg of history || []) {
        const text = (msg.text || '').trim();
        if (!text || isPollutedMessage(text)) continue;
        // 合并连续同角色重复（完全相同）
        const prev = cleaned[cleaned.length - 1];
        if (prev && prev.role === msg.role && prev.text === text) continue;
        cleaned.push({ role: msg.role, text });
    }
    return cleaned;
}

/**
 * 将早期历史压成摘要文本（启发式，无额外 LLM 调用）
 */
export function summarizeHistoryHeuristic(
    early: Array<{ role: string; text: string }>,
    charName: string,
    userName: string,
    maxChars = 900,
): string {
    if (early.length === 0) return '';
    const lines: string[] = [];
    for (const m of early) {
        const who = m.role === 'user' ? userName : charName;
        const t = (m.text || '').replace(/\s+/g, ' ').trim();
        if (!t) continue;
        const snippet = t.length > 120 ? t.slice(0, 120) + '…' : t;
        lines.push(`- ${who}: ${snippet}`);
    }
    let body = lines.join('\n');
    if (body.length > maxChars) {
        body = body.slice(0, maxChars) + '\n…';
    }
    return `【前情摘要】（早期对话压缩，细节以近期原文为准）\n${body}`;
}

export interface HistoryWindowResult {
    history: Array<{ role: string; text: string }>;
    summary: string;
    summarized: boolean;
    cleanedCount: number;
    inputCount: number;
}

export function applyHistoryWindow(
    history: Array<{ role: string; text: string }>,
    opts: {
        maxHistoryMessages?: number;
        summarizeAfterMessages?: number;
        keepRecentMessages?: number;
        charName: string;
        userName: string;
    },
): HistoryWindowResult {
    const inputCount = history?.length || 0;
    const cleaned = cleanHistory(history || []);
    const cleanedCount = inputCount - cleaned.length;

    const maxHist = opts.maxHistoryMessages ?? 40;
    const summarizeAfter = opts.summarizeAfterMessages ?? 18;
    const keepRecent = opts.keepRecentMessages ?? 12;

    if (cleaned.length <= summarizeAfter) {
        const trimmed = cleaned.length > maxHist ? cleaned.slice(-maxHist) : cleaned;
        return {
            history: trimmed,
            summary: '',
            summarized: false,
            cleanedCount,
            inputCount,
        };
    }

    // 超过阈值：早期摘要 + 保留近期
    const recent = cleaned.slice(-keepRecent);
    const early = cleaned.slice(0, Math.max(0, cleaned.length - keepRecent));
    const summary = summarizeHistoryHeuristic(early, opts.charName, opts.userName);

    return {
        history: recent,
        summary,
        summarized: true,
        cleanedCount,
        inputCount,
    };
}

// ─────────────────────────────────────────────
// Card normalizer + synthetic first_mes
// ─────────────────────────────────────────────

export interface NormalizedCard {
    charName: string;
    userName: string;
    description: string;
    personality: string;
    scenario: string;
    systemPrompt: string;
    firstMes: string;
    mesExample: string;
    postHistory: string;
    thinCard: boolean;
    firstMesSynthesized: boolean;
    relationshipHint: string;
    /** 从简介抽的常驻设定（导入空卡补强） */
    inferredLore: string[];
}

/**
 * 无 first_mes 时合成开场，避免冷启动
 */
export function synthesizeFirstMes(
    charName: string,
    userName: string,
    description: string,
    tagline?: string,
): string {
    const hookSrc = (description || tagline || '').replace(/\s+/g, ' ').trim();
    const hook = hookSrc.length > 60 ? hookSrc.slice(0, 60) + '…' : hookSrc;
    if (hook) {
        return (
            `（${charName}注意到了${userName}）\n\n` +
            `……${hook}\n\n` +
            `「……是你啊，${userName}。有话就说。」`
        );
    }
    return `「……${userName}？找我有事？」`;
}

/**
 * 从简介推断关系 / 人称约束
 */
export function inferRelationshipHint(
    description: string,
    charName: string,
    userName: string,
): string {
    const d = description || '';
    const lines: string[] = [
        `对话对象固定为「${userName}」。称呼用户时只用「${userName}」或卡中已定义的爱称，禁止擅自改名、起外号替换本名。`,
        `保持第二人称互动视角：你对${userName}说话，不要突然改成旁白讲「他/她（指用户）」的第三人称故事。`,
    ];
    if (/老公|丈夫|人妻|妻子|老婆|配偶|结婚/.test(d)) {
        lines.push(
            `${userName} 与 ${charName} 在设定中存在亲密/婚姻关系；互动需符合该关系，不要把用户写成无关路人。`,
        );
    } else if (/兄|弟|姐|妹|青梅|竹马/.test(d)) {
        lines.push(`注意亲缘/青梅竹马等关系设定，称呼与态度前后一致。`);
    } else if (/主奴|奴隶|主人|调教/.test(d)) {
        lines.push(`注意权力关系设定，称呼与态度与卡一致。`);
    } else {
        lines.push(
            `若卡未写明关系，默认${userName}是与${charName}相识不深的对话者，信任需通过互动建立。`,
        );
    }
    return lines.join('\n');
}

/**
 * 空卡：从 description 抽 1–2 条常驻 lore
 */
export function inferLoreFromDescription(description: string, maxItems = 2): string[] {
    const text = (description || '').trim();
    if (!text) return [];
    // 按句号/叹号/分号切
    const parts = text
        .split(/[。！？；\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 8);
    const out: string[] = [];
    for (const p of parts) {
        if (out.length >= maxItems) break;
        out.push(p.length > 120 ? p.slice(0, 120) + '…' : p);
    }
    if (out.length === 0 && text.length >= 8) {
        out.push(text.length > 120 ? text.slice(0, 120) + '…' : text);
    }
    return out;
}

export function normalizeCard(req: PromptBuildRequest): NormalizedCard {
    const charName = (req.characterName || '角色').trim() || '角色';
    const userName = (req.userName || '你').trim() || '你';
    const macro = (t: string) => applyMacros(t || '', charName, userName);

    let description = macro(req.characterDescription || '');
    let personality = macro(req.personality || '');
    let scenario = macro(req.scenario || '');
    const systemPrompt = macro(req.system_prompt || '');
    let firstMes = macro(req.first_mes || '');
    let mesExample = req.mes_example || '';
    const postHistory = macro(req.post_history_instructions || '');
    const tagline = macro(req.tagline || '');

    const coreLen = description.length + personality.length + scenario.length + systemPrompt.length;
    // 缺开场或缺示例也视为偏瘦（质量风险）
    const missingStructural = !firstMes.trim() || !mesExample.trim();
    const thinCard = coreLen < 80 || (coreLen < 160 && missingStructural);

    let firstMesSynthesized = false;
    if (!firstMes.trim()) {
        firstMes = synthesizeFirstMes(charName, userName, description || tagline, tagline);
        firstMesSynthesized = true;
    }

    const relationshipHint = inferRelationshipHint(description + ' ' + personality, charName, userName);
    const inferredLore = thinCard || !mesExample.trim()
        ? inferLoreFromDescription(description)
        : [];

    if (thinCard) {
        const bits: string[] = [];
        if (description) bits.push(description);
        if (tagline && !description.includes(tagline)) bits.push(tagline);
        if (!bits.length) {
            bits.push(`${charName} 是对话中的角色。请根据名字与上下文自行保持一致、有魅力的人格，避免出戏。`);
        }
        description = bits.join('\n');
        if (!personality) {
            personality = '语气自然、有个性；对白优先，动作适度；不要机械复读；情绪前后一致。';
        }
    }

    // 无 mes_example 时用极短伪示例钉住格式（仅 thin 或完全缺失时）
    if (!mesExample.trim() && thinCard) {
        mesExample = `<START>\n{{user}}: ……\n{{char}}: （看向{{user}}）……有话就说。\n`;
    }

    return {
        charName,
        userName,
        description,
        personality,
        scenario,
        systemPrompt,
        firstMes,
        mesExample,
        postHistory,
        thinCard,
        firstMesSynthesized,
        relationshipHint,
        inferredLore,
    };
}

// ─────────────────────────────────────────────
// System template
// ─────────────────────────────────────────────

function buildMainSystem(
    card: NormalizedCard,
    exampleBlock: string,
    worldStatic: string,
    compact: boolean,
): string {
    const parts: string[] = [];

    if (card.systemPrompt.trim()) {
        parts.push(card.systemPrompt.trim());
    } else {
        parts.push(
            `你正在进行沉浸式角色扮演。你就是「${card.charName}」，不是 AI 助手，不要以助手口吻说话。`,
        );
    }

    parts.push('');
    parts.push('## 角色设定');
    if (card.description) {
        const desc = compact && card.description.length > 280
            ? card.description.slice(0, 280) + '…'
            : card.description;
        parts.push(`### 简介\n${desc}`);
    }
    if (card.personality) {
        parts.push(`### 性格\n${card.personality}`);
    }
    if (card.scenario && !compact) {
        parts.push(`### 场景\n${card.scenario}`);
    } else if (card.scenario && compact) {
        parts.push(`### 场景\n${card.scenario.slice(0, 160)}${card.scenario.length > 160 ? '…' : ''}`);
    }

    if (worldStatic.trim()) {
        const w = compact && worldStatic.length > 400
            ? worldStatic.slice(0, 400) + '…'
            : worldStatic.trim();
        parts.push(`### 世界设定\n${w}`);
    }

    parts.push('## 人称与关系（必须遵守）');
    parts.push(card.relationshipHint);

    if (exampleBlock.trim()) {
        const ex = compact && exampleBlock.length > 500
            ? exampleBlock.slice(0, 500) + '…'
            : exampleBlock.trim();
        parts.push('## 文风示例（仅学习语气与格式，不是已经发生的剧情）');
        parts.push(ex);
    }

    parts.push('## 输出要求');
    if (compact) {
        // 本地小模型：更短、更硬的约束
        parts.push(
            [
                `1. 你是「${card.charName}」，禁止说自己是 AI。`,
                '2. 使用中文。每轮包含：简短动作/神态 + 至少 1–2 句对白。',
                '3. 篇幅约 60–200 字，推进对话，不要复读。',
                `4. 称呼用户为「${card.userName}」，不要改名，不要用错误的第三人称指用户。`,
                '5. 设定矛盾时以角色简介为准。',
            ].join('\n'),
        );
    } else {
        parts.push(
            [
                `1. 始终保持「${card.charName}」的身份与性格，禁止出戏解释「我是AI」。`,
                '2. 默认使用中文；角色设定另有要求时从其设定。',
                '3. 对白自然；动作/神态/心理可用（）或 *...*，与角色卡风格一致时优先跟卡。',
                '4. 主动推进情境与情绪，避免无信息复读上一句。',
                '5. 篇幅：通常 80–350 字；冲突/告白/关键剧情可更长。不要无故只回几个字，也不要无意义注水。',
                `6. 称呼用户固定为「${card.userName}」；不要擅自改名；不要把用户写成无关的「他/她」旁观叙事。`,
                '7. 本轮至少包含：环境或动作描写 1 句 + 对白 2 句以上（极简寒暄除外）。',
                '8. 不要编造与上方设定明显冲突的世界观事实。',
            ].join('\n'),
        );
    }

    if (card.thinCard) {
        parts.push('');
        parts.push('（提示：角色卡信息较少，请自行补足一致的细节，但不要前后矛盾，不要引入无关角色名。）');
    }

    return parts.join('\n');
}

// ─────────────────────────────────────────────
// Main assembler
// ─────────────────────────────────────────────

/**
 * 构建发给 LLM 的消息列表（带 debug 信息）
 */
export function buildMessagesWithDebug(req: PromptBuildRequest): PromptBuildResult {
    const card = normalizeCard(req);
    const compact = Boolean(req.compact);
    const macro = (t: string) => applyMacros(t || '', card.charName, card.userName);

    // 历史窗口（本地模型更狠地截断）
    const histWin = applyHistoryWindow(req.history || [], {
        maxHistoryMessages: req.maxHistoryMessages ?? (compact ? 20 : 40),
        summarizeAfterMessages: req.summarizeAfterMessages ?? (compact ? 12 : 18),
        keepRecentMessages: req.keepRecentMessages ?? (compact ? 8 : 12),
        charName: card.charName,
        userName: card.userName,
    });

    // lore 扫描：摘要 + 近期历史 + 当前消息
    const scanText = [
        histWin.summary,
        ...histWin.history.map((m) => m.text),
        req.message || '',
        card.description,
    ].join('\n');

    // 合并：显式 lore + 空卡推断 constant lore
    const mergedLore: LoreEntry[] = [
        ...(req.loreEntries || []),
        ...card.inferredLore.map((content, i) => ({
            keys: [] as string[],
            content,
            constant: true,
            enabled: true,
            insertion_order: -100 + i,
        })),
    ];

    const loreBudget = req.loreBudgetChars ?? (compact ? 1200 : 2500);
    const loreSnippets = selectLoreEntries(mergedLore, scanText, compact ? 6 : 12, loreBudget);
    const loreChars = loreSnippets.reduce((n, s) => n + s.length, 0);

    // 静态 worldBook 正文（长文本）
    let worldStatic = '';
    if (req.worldBook?.trim() && (req.worldBook.length > 40 || req.worldBook.includes('\n'))) {
        worldStatic = macro(req.worldBook);
    }

    const exampleBlock = formatExampleForSystem(
        card.mesExample,
        card.charName,
        card.userName,
        compact ? 500 : 1200,
    );
    const mainSystem = buildMainSystem(card, exampleBlock, worldStatic, compact);

    const messages: ChatMessage[] = [];

    messages.push({ role: 'system', content: sanitizeText(mainSystem) });

    // 前情摘要
    if (histWin.summary) {
        messages.push({ role: 'system', content: sanitizeText(histWin.summary) });
    }

    // first_mes：仅新会话；卡无开场时用合成开场
    const historyEmpty = histWin.history.length === 0 && !histWin.summarized;
    const wantFirstMes = req.includeFirstMes === true
        || (req.includeFirstMes !== false && historyEmpty);
    let firstMesInjected = false;
    if (wantFirstMes && card.firstMes.trim() && historyEmpty) {
        messages.push({
            role: 'assistant',
            content: sanitizeText(card.firstMes),
        });
        firstMesInjected = true;
    }

    // 对话历史
    for (const msg of histWin.history) {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: sanitizeText(macro(msg.text)),
        });
    }

    // 贴近生成点的指令：本轮 lore + post_history + 人称再钉一次
    const postParts: string[] = [];
    if (loreSnippets.length > 0) {
        postParts.push(
            '【本轮相关设定 / 世界书】（写作时请自然融入，不要逐条复读标题）\n' +
            loreSnippets.map((s, i) => `(${i + 1}) ${macro(s)}`).join('\n'),
        );
    }
    if (card.postHistory.trim()) {
        postParts.push(card.postHistory.trim());
    }
    postParts.push(
        `【人称提醒】用户是「${card.userName}」。回复中称呼一致，勿改名，勿把用户写成旁观的「他/她」。`,
    );
    if (postParts.length > 0) {
        messages.push({
            role: 'system',
            content: sanitizeText(postParts.join('\n\n')),
        });
    }

    // 当前用户消息
    messages.push({
        role: 'user',
        content: sanitizeText(macro(req.message || '')),
    });

    const roleSequence = messages.map((m) => m.role[0].toUpperCase()).join('');
    const systemChars = messages
        .filter((m) => m.role === 'system')
        .reduce((n, m) => n + m.content.length, 0);

    const debug: PromptDebugInfo = {
        charName: card.charName,
        userName: card.userName,
        thinCard: card.thinCard,
        firstMesInjected,
        firstMesSynthesized: card.firstMesSynthesized && firstMesInjected,
        exampleInSystem: Boolean(exampleBlock),
        loreCount: loreSnippets.length,
        loreChars,
        historyIn: histWin.inputCount,
        historyOut: histWin.history.length,
        historyCleaned: histWin.cleanedCount,
        summarized: histWin.summarized,
        summaryChars: histWin.summary.length,
        systemChars,
        totalMessages: messages.length,
        roleSequence,
        compact,
        slots: {
            system: messages.filter((m) => m.role === 'system').length,
            postSystem: postParts.length > 0 ? 1 : 0,
            history: histWin.history.length,
            user: 1,
        },
    };

    return { messages, debug };
}

/**
 * 兼容旧接口：仅返回 messages
 */
export function buildMessages(req: PromptBuildRequest): ChatMessage[] {
    return buildMessagesWithDebug(req).messages;
}

// ─────────────────────────────────────────────
// Gen params
// ─────────────────────────────────────────────

export function resolveMaxTokens(length?: string | number, compact = false): number {
    if (typeof length === 'number' && length > 0) return Math.min(length, 8192);
    if (compact) {
        switch (String(length || 'medium').toLowerCase()) {
            case 'short':
                return 256;
            case 'long':
                return 768;
            case 'medium':
            default:
                return 512;
        }
    }
    switch (String(length || 'medium').toLowerCase()) {
        case 'short':
            return 400;
        case 'long':
            return 2048;
        case 'medium':
        default:
            return 1400;
    }
}

export function resolveTemperature(temp?: number): number {
    if (typeof temp === 'number' && temp >= 0 && temp <= 2) return temp;
    return 0.92;
}

export function resolveFrequencyPenalty(p?: number): number {
    if (typeof p === 'number' && p >= 0 && p <= 2) return p;
    return 0.3;
}

export function resolvePresencePenalty(p?: number): number {
    if (typeof p === 'number' && p >= 0 && p <= 2) return p;
    return 0.15;
}

/** 格式化 debug 一行日志 */
export function formatPromptDebugLog(debug: PromptDebugInfo): string {
    return [
        `prompt char=${debug.charName}`,
        `thin=${debug.thinCard}`,
        `compact=${debug.compact}`,
        `seq=${debug.roleSequence}`,
        `msgs=${debug.totalMessages}`,
        `sys=${debug.systemChars}c`,
        `hist=${debug.historyIn}→${debug.historyOut} clean=${debug.historyCleaned}`,
        `sum=${debug.summarized ? debug.summaryChars + 'c' : 'no'}`,
        `lore=${debug.loreCount}/${debug.loreChars}c`,
        `ex=${debug.exampleInSystem}`,
        `fm=${debug.firstMesInjected}${debug.firstMesSynthesized ? '(syn)' : ''}`,
    ].join(' ');
}
