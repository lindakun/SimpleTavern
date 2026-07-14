export interface LlmConfig {
    id: string;
    name: string;
    baseUrl: string;
    model: string;
    apiKey: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LoreEntryInput {
    keys: string[];
    secondary_keys?: string[];
    content: string;
    constant?: boolean;
    enabled?: boolean;
    selective?: boolean;
    insertion_order?: number;
}

export interface ChatRequest {
    message: string;
    history: Array<{ role: string; text: string }>;
    characterName: string;
    characterDescription: string;
    // V3 角色卡字段
    personality?: string;
    scenario?: string;
    first_mes?: string;
    mes_example?: string;
    system_prompt?: string;
    post_history_instructions?: string;
    alternate_greetings?: string[];
    // 兼容旧字段
    worldBook?: string;
    /** 角色内嵌世界书 / 已解析 lore 条目 */
    character_book?: unknown;
    loreEntries?: LoreEntryInput[];
    provider?: string;
    /** 用户称呼 {{user}} */
    userName?: string;
    /** 是否注入 first_mes（默认：仅历史为空时） */
    includeFirstMes?: boolean;
    /** 生成参数 */
    temperature?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    /** short | medium | long 或具体 token 数 */
    responseLength?: string | number;
    max_tokens?: number;
    /** 返回 prompt debug 信息（非流式 / 或日志） */
    debug?: boolean;
}

export interface ChatResponse {
    text: string;
    provider: string;
    model: string;
    debug?: unknown;
}
