import { ChatRequest, ChatResponse, LlmConfig, ChatMessage } from '../types.js';
import { getLlmConfigs, getActiveLlm } from '../llm-config.js';
import { logger } from '../../../common/logger.js';
import { getConfig } from '../../../config/index.js';
import * as worldsService from '../../worlds/worlds.service.js';
import {
    buildMessages,
    normalizeCharacterBook,
    resolveMaxTokens,
    resolveTemperature,
    type LoreEntry,
} from './prompt-builder.js';

export { buildMessages, normalizeCharacterBook, parseMesExample, applyMacros, selectLoreEntries } from './prompt-builder.js';

/**
 * 解析世界书文件条目（worldBook 为 file_id 时）
 */
function loadWorldLoreEntries(worldBook?: string): LoreEntry[] {
    if (!worldBook?.trim()) return [];
    // 过长文本视为已内联 lore，不当作文件名
    if (worldBook.length > 80 || worldBook.includes('\n')) return [];

    try {
        const config = getConfig();
        const world = worldsService.getWorld(config.dataRoot, worldBook);
        if (!world?.entries) return [];
        return normalizeCharacterBook({ entries: world.entries });
    } catch (err) {
        logger.debug(`加载世界书失败: ${worldBook}`, (err as Error).message);
        return [];
    }
}

/**
 * 合并请求中的 lore 来源
 */
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

function resolveProvider(req: ChatRequest): LlmConfig | undefined {
    const configs = getLlmConfigs();
    if (req.provider) {
        const found = configs.find((c) => c.id === req.provider || c.name === req.provider);
        if (found) return found;
    }
    return getActiveLlm();
}

function buildPromptMessages(req: ChatRequest): ChatMessage[] {
    const loreEntries = collectLoreEntries(req);
    // 有历史时仍注入 first_mes 作为角色开场记忆（与 ST 类似）；前端可关
    return buildMessages({
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
        loreEntries,
        userName: req.userName,
        includeFirstMes: req.includeFirstMes,
    });
}

/**
 * 通过 OpenAI-compatible API 发送聊天补全请求（非流式）
 */
async function callLlmApi(
    config: LlmConfig,
    messages: ChatMessage[],
    opts: { temperature: number; max_tokens: number },
): Promise<string> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    logger.debug(`LLM 请求: ${url}, model=${config.model}, temp=${opts.temperature}, max_tokens=${opts.max_tokens}`);

    const response = await fetch(url, {
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
        }),
        signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`LLM API 错误 (${response.status}): ${errorText}`);
    }

    const data = await response.json() as any;

    logger.debug(`LLM 原始响应: ${JSON.stringify(data)}`);

    if (!data.choices || data.choices.length === 0) {
        throw new Error(`LLM API 返回空响应, 原始数据: ${JSON.stringify(data)}`);
    }

    const firstChoice = data.choices[0];
    const finishReason = firstChoice.finish_reason;
    const content = firstChoice.message?.content ?? firstChoice.delta?.content ?? '';

    if (finishReason && finishReason !== 'stop') {
        logger.warn(`LLM 非正常结束, finish_reason=${finishReason}, content=${JSON.stringify(content)}`);
    }

    return content || '';
}

/**
 * 通过 OpenAI-compatible API 流式发送聊天补全请求
 */
async function callLlmApiStream(
    config: LlmConfig,
    messages: ChatMessage[],
    opts: { temperature: number; max_tokens: number },
): Promise<ReadableStream<Uint8Array>> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    logger.info(
        `LLM 流式请求: ${url}, model=${config.model}, messages=${messages.length}, temp=${opts.temperature}, max_tokens=${opts.max_tokens}`,
    );
    const startTime = Date.now();

    const response = await fetch(url, {
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
            stream: true,
        }),
        signal: AbortSignal.timeout(120_000),
    });

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

function resolveGenOpts(req: ChatRequest) {
    const max_tokens = req.max_tokens
        ? resolveMaxTokens(req.max_tokens)
        : resolveMaxTokens(req.responseLength);
    const temperature = resolveTemperature(req.temperature);
    return { max_tokens, temperature };
}

/**
 * 流式处理聊天请求 — 返回 SSE ReadableStream
 */
export async function processChatStream(req: ChatRequest): Promise<ReadableStream<Uint8Array>> {
    const activeConfig = resolveProvider(req);
    if (!activeConfig) {
        throw new Error('未配置 LLM，无法使用流式聊天');
    }

    const messages = buildPromptMessages(req);
    return callLlmApiStream(activeConfig, messages, resolveGenOpts(req));
}

/**
 * 处理聊天请求 — 非流式
 */
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

    const messages = buildPromptMessages(req);

    try {
        const reply = await callLlmApi(activeConfig, messages, resolveGenOpts(req));
        return { text: reply || '……（未收到回复）', provider: activeConfig.id, model: activeConfig.model };
    } catch (err: any) {
        logger.error('LLM 调用失败:', err);
        throw err;
    }
}

/**
 * 获取可用 LLM 列表
 */
export function getProviders() {
    const active = getActiveLlm();
    return getLlmConfigs().map((c) => ({
        id: c.id,
        name: c.name,
        model: c.model,
        active: active?.id === c.id,
        // 粗略标记本地模型（host.docker.internal / localhost / 11434 / 8081）
        isLocal: /localhost|127\.0\.0\.1|host\.docker\.internal|11434|8081/.test(c.baseUrl),
    }));
}

function getSimulatedReply(characterName: string): string {
    const name = characterName.toLowerCase();
    if (name.includes('yuki') || name.includes('柚姬')) {
        const r = [
            '哼，你又在入侵我的个人终端？好大的胆子。下不为例……听懂了吗？',
            '啧，一上来就问这个……你脑袋里的网络驱动器需要重置了吧？',
            '真是服了你了……算了，跟你讲讲新京贫民区的极光也是可以的，不过不许告诉本区的主脑！',
            '傲娇？谁是傲娇啊！我只是懒得理你……哼！',
        ];
        return r[Math.floor(Math.random() * r.length)];
    }
    if (name.includes('yuzu') || name.includes('柚子')) {
        const r = [
            '喵呜！网络信号连接成功！今天有什么烦恼喵？',
            '太棒了喵！让元气的声波扫清你的大脑高频劳损吧！',
            '（猫耳欢快地扑棱两下）今天的心率很稳定哦，奖励你一个特制的数码治愈音符~',
        ];
        return r[Math.floor(Math.random() * r.length)];
    }
    if (name.includes('samurai') || name.includes('武士') || name.includes('sam')) {
        const r = [
            '（握紧了刀柄）多说无益。在这片霓虹荒废的街道，唯有刀刃下的真相不会骗人。',
            '你还年轻。别把命丢在大公司的佣兵手里。',
            '哼。只要你给得齐源晶，我的刀刃，就是你的影子。',
        ];
        return r[Math.floor(Math.random() * r.length)];
    }
    return `【${characterName}】："信号收到了。在新京2099的雨夜，你找我有什么事？"`;
}
