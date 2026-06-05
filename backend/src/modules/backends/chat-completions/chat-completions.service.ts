import { ChatRequest, ChatResponse, LlmConfig, ChatMessage } from '../types.js';
import { getLlmConfigs, getActiveLlm } from '../llm-config.js';
import { logger } from '../../../common/logger.js';

/**
 * 构建角色扮演的消息列表
 * 将用户请求 + 角色 V3 卡信息转换为 LLM 消息格式
 */
function buildMessages(req: ChatRequest): ChatMessage[] {
    const messages: ChatMessage[] = [];

    // 系统指令 — 使用 system_prompt 或自动构建
    let systemPrompt: string;

    if (req.system_prompt) {
        // 使用角色卡自带的 system_prompt
        systemPrompt = req.system_prompt;
    } else {
        // 自动构建系统提示词
        systemPrompt = `You are roleplaying as a fictional character named "${req.characterName}".`;
    }

    // 追加角色描述
    if (req.characterDescription) {
        systemPrompt += `\n\nCharacter Description:\n${req.characterDescription}`;
    }

    // 追加性格
    if (req.personality) {
        systemPrompt += `\n\nPersonality:\n${req.personality}`;
    }

    // 追加场景
    if (req.scenario) {
        systemPrompt += `\n\nScenario:\n${req.scenario}`;
    }

    // 追加世界书
    if (req.worldBook) {
        systemPrompt += `\n\nWorldbook / Lore & Speaking Guidelines:\n${req.worldBook}`;
    }

    // 通用规则（仅在无 system_prompt 时添加）
    if (!req.system_prompt) {
        systemPrompt += `\n\nCRITICAL RULES:
1. Always stay in character. Never speak as an AI assistant.
2. Speak primarily in Chinese unless the character's description specifies otherwise.
3. Keep responses conversational and relatively short.
4. Show your character's personality traits in your responses.`;
    }

    messages.push({ role: 'system', content: systemPrompt });

    // 如果有 first_mes，作为 assistant 的初始消息
    if (req.first_mes) {
        const charName = req.characterName || 'Character';
        messages.push({
            role: 'assistant',
            content: req.first_mes
                .replace(/\{\{char\}\}/gi, charName)
                .replace(/\{\{user\}\}/gi, 'User'),
        });
    }

    // 历史消息 — 只保留最近 N 轮对话，防止上下文窗口溢出
    const MAX_HISTORY_MESSAGES = 30; // 约 15 轮对话（user + assistant）
    if (req.history && req.history.length > 0) {
        const recentHistory = req.history.length > MAX_HISTORY_MESSAGES
            ? req.history.slice(-MAX_HISTORY_MESSAGES)
            : req.history;

        if (req.history.length > MAX_HISTORY_MESSAGES) {
            logger.debug(`历史消息已截断: ${req.history.length} → ${MAX_HISTORY_MESSAGES} 条`);
        }

        for (const msg of recentHistory) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.text,
            });
        }
    }

    // 历史记录后指令
    if (req.post_history_instructions) {
        messages.push({ role: 'system', content: req.post_history_instructions });
    }

    // 当前消息
    messages.push({ role: 'user', content: req.message });

    return messages;
}

/**
 * 通过 OpenAI-compatible API 发送聊天补全请求（非流式）
 */
async function callLlmApi(config: LlmConfig, messages: ChatMessage[]): Promise<string> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    logger.debug(`LLM 请求: ${url}, model=${config.model}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            temperature: 0.9,
            max_tokens: 8192,
        }),
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
    const content = firstChoice.message?.content ?? firstChoice.delta?.content;

    if (finishReason && finishReason !== 'stop') {
        logger.warn(`LLM 非正常结束, finish_reason=${finishReason}, content=${JSON.stringify(content)}`);
    }

    return content || '';
}

/**
 * 通过 OpenAI-compatible API 流式发送聊天补全请求
 * 返回 ReadableStream<Uint8Array>，逐 token 产出 SSE 数据
 */
async function callLlmApiStream(config: LlmConfig, messages: ChatMessage[]): Promise<ReadableStream<Uint8Array>> {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    logger.debug(`LLM 流式请求: ${url}, model=${config.model}`);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
            model: config.model,
            messages,
            temperature: 0.9,
            max_tokens: 8192,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`LLM API 错误 (${response.status}): ${errorText}`);
    }

    if (!response.body) {
        throw new Error('LLM API 未返回流式响应体');
    }

    return response.body;
}

/**
 * 流式处理聊天请求 — 返回 SSE ReadableStream
 */
export async function processChatStream(req: ChatRequest): Promise<ReadableStream<Uint8Array>> {
    const configs = getLlmConfigs();

    let activeConfig: LlmConfig | undefined;
    if (req.provider) {
        activeConfig = configs.find(c => c.id === req.provider || c.name === req.provider);
    }
    if (!activeConfig) {
        activeConfig = getActiveLlm();
    }

    if (!activeConfig) {
        throw new Error('未配置 LLM，无法使用流式聊天');
    }

    const messages = buildMessages(req);
    return callLlmApiStream(activeConfig, messages);
}

/**
 * 处理聊天请求 — 前端主入口
 */
export async function processChat(req: ChatRequest): Promise<ChatResponse> {
    const configs = getLlmConfigs();

    // 选择 LLM
    let activeConfig: LlmConfig | undefined;
    if (req.provider) {
        activeConfig = configs.find(c => c.id === req.provider || c.name === req.provider);
    }
    if (!activeConfig) {
        activeConfig = getActiveLlm();
    }

    if (!activeConfig) {
        // 无配置时返回模拟回复
        logger.warn('未配置 LLM，使用模拟回复');
        return {
            text: getSimulatedReply(req.characterName),
            provider: 'mock',
            model: 'mock',
        };
    }

    const messages = buildMessages(req);

    try {
        const reply = await callLlmApi(activeConfig, messages);
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
    return getLlmConfigs().map(c => ({
        id: c.id,
        name: c.name,
        model: c.model,
    }));
}

/**
 * 无 LLM 配置时的模拟回复
 */
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
