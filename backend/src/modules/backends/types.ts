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
    provider?: string;
}

export interface ChatResponse {
    text: string;
    provider: string;
    model: string;
}
