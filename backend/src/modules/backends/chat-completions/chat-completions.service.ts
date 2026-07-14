import { ChatRequest, ChatResponse, LlmConfig, ChatMessage } from '../types.js';
import { getLlmConfigs, getActiveLlm } from '../llm-config.js';
import { logger } from '../../../common/logger.js';
import { getConfig } from '../../../config/index.js';
import * as worldsService from '../../worlds/worlds.service.js';
import {
    buildMessagesWithDebug,
    normalizeCharacterBook,
    resolveMaxTokens,
    resolveTemperature,
    resolveFrequencyPenalty,
    resolvePresencePenalty,
    formatPromptDebugLog,
    type LoreEntry,
    type PromptDebugInfo,
} from './prompt-builder.js';

export {
    buildMessages,
    buildMessagesWithDebug,
    normalizeCharacterBook,
    parseMesExample,
    applyMacros,
    selectLoreEntries,
    cleanHistory,
    summarizeHistoryHeuristic,
    formatExampleForSystem,
    resolveMaxTokens,
    resolveTemperature,
} from './prompt-builder.js';

/**
 * 解析世界书文件条目（worldBook 为 file_id 时）
 */
function loadWorldLoreEntries(worldBook?: string): LoreEntry[] {
    if (!worldBook?.trim()) return [];
    // 过长文本 / 含换行视为已内联 lore
    if (worldBook.length > 80 || worldBook.includes('\n')) return [];

    try {
        const config = getConfig();
        // 尝试原名与去掉后缀
        const candidates = [worldBook, worldBook.replace(/\.json$/i, '')];
        for (const name of candidates) {
            const world = worldsService.getWorld(config.dataRoot, name);
            if (world?.entries) {
                const lore = normalizeCharacterBook({ entries: world.entries });
                if (lore.length > 0) {
                    logger.debug(`世界书已加载: ${name}, entries=${lore.length}`);
                    return lore;
                }
            }
        }
    } catch (err) {
        logger.debug(`加载世界书失败: ${worldBook}`, (err as Error).message);
    }
    return [];
}

function collectLoreEntries(req: ChatRequest): LoreEntry[] {
    const fromBook = normalizeCharacterBook(req.character_book);
    const fromExplicit = (req.loreEntries || []).map((e) => ({
        keys: e.keys || [],
        secondary_keys: e.secondary_keys,
        content: e.content || '',
        constant: e.constant,
        enabled: e.enabled,
        selective: e.selective,
        insertion_order: e.insertion_order,
    }));
    const fromWorldFile = loadWorldLoreEntries(req.worldBook);
    return [...fromBook, ...fromExplicit, ...fromWorldFile];
}

function isLocalConfig(config: LlmConfig): boolean {
    return /localhost|127\.0\.0\.1|host\.docker\.internal|:11434|:8081|:8080/.test(config.baseUrl);
}

function resolveProvider(req: ChatRequest): LlmConfig | undefined {
    const configs = getLlmConfigs();
    if (req.provider) {
        const found = configs.find((c) => c.id === req.provider || c.name === req.provider);
        if (found) return found;
    }
    return getActiveLlm();
}

export interface BuiltPrompt {
    messages: ChatMessage[];
    debug: PromptDebugInfo;
}

export function buildPromptMessages(req: ChatRequest, opts?: { compact?: boolean }): BuiltPrompt {
    const loreEntries = collectLoreEntries(req);
    const { messages, debug } = buildMessagesWithDebug({
        message: req.message,
        history: req.history || [],
        characterName: req.characterName,
        characterDescription: req.characterDescription,
        personality: req.personality,
        scenario: req.scenario,
        first_mes: req.first_mes,
        mes_example: req.mes_example,
        system_prompt: req.system_prompt,
        post_history_instructions: req.post_history_instructions,
        worldBook: req.worldBook,
        tagline: req.tagline,
        loreEntries,
        userName: req.userName,
        includeFirstMes: req.includeFirstMes,
        compact: opts?.compact,
    });

    logger.info(formatPromptDebugLog(debug));
    if (debug.thinCard) {
        logger.warn(`角色卡信息偏少: ${debug.charName}，已启用兜底人设`);
    }
    if (debug.firstMesSynthesized) {
        logger.info(`已为 ${debug.charName} 合成开场 first_mes`);
    }
    return { messages, debug };
}

function resolveGenOpts(req: ChatRequest, compact = false) {
    const max_tokens = req.max_tokens
        ? resolveMaxTokens(req.max_tokens, compact)
        : resolveMaxTokens(req.responseLength, compact);
    return {
        max_tokens,
        temperature: resolveTemperature(req.temperature),
        // 本地模型略降 penalty，减少怪异收敛
        frequency_penalty: resolveFrequencyPenalty(
            req.frequency_penalty ?? (compact ? 0.15 : undefined),
        ),
        presence_penalty: resolvePresencePenalty(
            req.presence_penalty ?? (compact ? 0.1 : undefined),
        ),
    };
}

async function callLlmApi(
    config: LlmConfig,
    messages: ChatMessage[],
    opts: { temperature: number; max_tokens: number; frequency_penalty: number; presence_penalty: number },
): Promise<string> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    logger.debug(
        `LLM 请求: ${url}, model=${config.model}, temp=${opts.temperature}, max_tokens=${opts.max_tokens}, fp=${opts.frequency_penalty}`,
    );

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: opts.temperature,
                max_tokens: opts.max_tokens,
                frequency_penalty: opts.frequency_penalty,
                presence_penalty: opts.presence_penalty,
            }),
            signal: AbortSignal.timeout(60_000),
        });
    } catch (err: any) {
        const cause = err?.cause?.message || err?.cause?.code || err?.cause || '';
        throw new Error(
            `无法连接模型「${config.name}」(${config.baseUrl}): ${err?.message || 'fetch failed'}` +
            (cause ? ` — ${cause}` : '') +
            '。请切换可用模型或检查网络/出网配置。',
        );
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`LLM API 错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;
    if (!data.choices || data.choices.length === 0) {
        throw new Error(`LLM API 返回空响应, 原始数据: ${JSON.stringify(data)}`);
    }

    const firstChoice = data.choices[0];
    const finishReason = firstChoice.finish_reason;
    const content = firstChoice.message?.content ?? firstChoice.delta?.content ?? '';

    if (finishReason && finishReason !== 'stop') {
        logger.warn(`LLM 非正常结束, finish_reason=${finishReason}`);
    }

    return content || '';
}

async function callLlmApiStream(
    config: LlmConfig,
    messages: ChatMessage[],
    opts: { temperature: number; max_tokens: number; frequency_penalty: number; presence_penalty: number },
): Promise<ReadableStream<Uint8Array>> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    logger.info(
        `LLM 流式请求: ${url}, model=${config.model}, messages=${messages.length}, temp=${opts.temperature}, max_tokens=${opts.max_tokens}, fp=${opts.frequency_penalty}`,
    );
    const startTime = Date.now();

    let response: Response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: opts.temperature,
                max_tokens: opts.max_tokens,
                frequency_penalty: opts.frequency_penalty,
                presence_penalty: opts.presence_penalty,
                stream: true,
            }),
            signal: AbortSignal.timeout(120_000),
        });
    } catch (err: any) {
        const cause = err?.cause?.message || err?.cause?.code || err?.cause || '';
        logger.error(`LLM 流式连接失败 [${config.id}] ${url}:`, err?.message, cause);
        throw new Error(
            `无法连接模型「${config.name}」(${config.baseUrl}): ${err?.message || 'fetch failed'}` +
            (cause ? ` — ${cause}` : '') +
            '。请在聊天页切换到本地可用模型，或修复服务器 Docker 出网。',
        );
    }

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`LLM API 错误 (${response.status}): ${errorText}`);
    }

    if (!response.body) {
        throw new Error('LLM API 未返回流式响应体');
    }

    logger.info(`LLM 流式响应已连接, 耗时: ${Date.now() - startTime}ms`);
    return response.body;
}

/**
 * 流式处理 — 返回 stream + debug 元信息
 */
export async function processChatStream(req: ChatRequest): Promise<{
    stream: ReadableStream<Uint8Array>;
    debug: PromptDebugInfo;
    provider: string;
    model: string;
    isLocal: boolean;
}> {
    const activeConfig = resolveProvider(req);
    if (!activeConfig) {
        throw new Error('未配置 LLM，无法使用流式聊天');
    }

    const compact = isLocalConfig(activeConfig);
    const { messages, debug } = buildPromptMessages(req, { compact });
    const stream = await callLlmApiStream(activeConfig, messages, resolveGenOpts(req, compact));
    return {
        stream,
        debug,
        provider: activeConfig.id,
        model: activeConfig.model,
        isLocal: compact,
    };
}

export async function processChat(req: ChatRequest): Promise<ChatResponse> {
    const activeConfig = resolveProvider(req);

    if (!activeConfig) {
        logger.warn('未配置 LLM，使用模拟回复');
        return {
            text: getSimulatedReply(req.characterName),
            provider: 'mock',
            model: 'mock',
        };
    }

    const compact = isLocalConfig(activeConfig);
    const { messages, debug } = buildPromptMessages(req, { compact });

    try {
        const reply = await callLlmApi(activeConfig, messages, resolveGenOpts(req, compact));
        const result: ChatResponse = {
            text: reply || '……（未收到回复）',
            provider: activeConfig.id,
            model: activeConfig.model,
        };
        if (req.debug) result.debug = debug;
        return result;
    } catch (err: any) {
        logger.error('LLM 调用失败:', err);
        throw err;
    }
}

/**
 * 仅构建 prompt（调试用，不调用 LLM）
 */
export function debugBuildPrompt(req: ChatRequest): { messages: ChatMessage[]; debug: PromptDebugInfo } {
    const activeConfig = resolveProvider(req);
    const compact = activeConfig ? isLocalConfig(activeConfig) : false;
    return buildPromptMessages(req, { compact });
}

export function getProviders() {
    const active = getActiveLlm();
    return getLlmConfigs().map((c) => ({
        id: c.id,
        name: c.name,
        model: c.model,
        active: active?.id === c.id,
        isLocal: /localhost|127\.0\.0\.1|host\.docker\.internal|11434|8081/.test(c.baseUrl),
    }));
}

function getSimulatedReply(characterName: string): string {
    return `【${characterName}】："信号收到了。在新京2099的雨夜，你找我有什么事？"`;
}
