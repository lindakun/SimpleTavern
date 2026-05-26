/**
 * 角色数据类型 — 兼容 SillyTavern V2 角色卡格式
 */

export interface CharacterV2 {
    spec: 'chara_card_v2';
    spec_version: '2.0';
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creatorcomment: string;
    avatar: string;
    chat: string;
    talkativeness: number;
    fav: boolean;
    tags: string[];
    create_date: string;
    date_added?: number;
    date_last_chat?: number;
    chat_size?: number;
    data_size?: number;
    json_data?: string;

    data: {
        name: string;
        description: string;
        personality: string;
        scenario: string;
        first_mes: string;
        mes_example: string;
        creator_notes: string;
        system_prompt: string;
        post_history_instructions: string;
        tags: string[];
        creator: string;
        character_version: string;
        alternate_greetings: string[];
        extensions: {
            talkativeness: number;
            fav: boolean;
            world: string;
            depth_prompt: {
                prompt: string;
                depth: number;
                role: string;
            };
            [key: string]: unknown;
        };
        character_book?: CharacterBookEntry;
    };
}

export interface CharacterBookEntry {
    name: string;
    entries: CharacterBookEntryItem[];
}

export interface CharacterBookEntryItem {
    id: number;
    keys: string[];
    secondary_keys: string[];
    comment: string;
    content: string;
    constant: boolean;
    selective: boolean;
    insertion_order: number;
    enabled: boolean;
    position: string;
    use_regex: boolean;
    extensions: Record<string, unknown>;
}

/**
 * 角色列表返回的摘要信息
 */
export interface CharacterShallow {
    shallow: true;
    name: string;
    avatar: string;
    chat: string;
    fav: boolean;
    date_added: number;
    create_date: string;
    date_last_chat: number;
    chat_size: number;
    data_size: number;
    tags: string[];
    data: {
        name: string;
        character_version: string;
        creator: string;
        creator_notes: string;
        tags: string[];
        extensions: {
            fav: boolean;
            world: string;
        };
    };
}

export interface CharacterListItem {
    /** 文件名（不含路径） */
    avatar: string;
    /** 角色名 */
    name: string;
    /** 聊天状态 */
    chat: string;
    /** 是否收藏 */
    fav: boolean;
    /** 添加时间 */
    date_added: number;
    /** 创建日期 */
    create_date: string;
    /** 最后聊天时间 */
    date_last_chat: number;
    /** 聊天总大小 */
    chat_size: number;
    /** 数据大小 */
    data_size: number;
    /** 标签 */
    tags: string[];
    /** 是否浅层数据 */
    shallow?: boolean;
    /** 完整角色数据（非浅层时） */
    data?: CharacterV2['data'];
}
