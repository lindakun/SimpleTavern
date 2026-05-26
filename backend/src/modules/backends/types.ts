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
    worldBook?: string;
    provider?: string;
}

export interface ChatResponse {
    text: string;
    provider: string;
    model: string;
}
