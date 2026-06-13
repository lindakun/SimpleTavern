/**
 * 聊天消息类型 — 兼容 SillyTavern 格式
 */

export interface ChatMetadata {
    integrity?: string;
    [key: string]: unknown;
}

export interface ChatHeader {
    chat_metadata: ChatMetadata;
    user_name: string;
    character_name: string;
}

export interface ChatMessage {
    name: string;
    is_user: boolean;
    is_name?: boolean;
    send_date: string;
    mes: string;
    extra: Record<string, unknown>;
    swipes?: string[];
    swipe_id?: number;
    [key: string]: unknown;
}

export type Chat = [ChatHeader, ...ChatMessage[]];

export interface ChatInfo {
    file_id: string;
    file_name: string;
    file_size: number;
    chat_items: number;
    mes: string;
    last_mes: number | string;
    chat_metadata?: ChatMetadata;
    match?: boolean;
}
