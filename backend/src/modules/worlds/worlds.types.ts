/**
 * 世界书（World Info）数据类型
 * 兼容原 SillyTavern world-info.js 的内部格式
 */

export interface WorldInfoEntry {
    uid: number;
    key: string[];
    keysecondary: string[];
    comment: string;
    content: string;
    constant: boolean;
    vectorized: boolean;
    selective: boolean;
    selectiveLogic: number;
    addMemo: boolean;
    order: number;
    position: number;
    disable: boolean;
    ignoreBudget: boolean;
    excludeRecursion: boolean;
    preventRecursion: boolean;
    delayUntilRecursion: number;
    probability: number;
    useProbability: boolean;
    depth: number;
    outletName: string;
    group: string;
    groupOverride: boolean;
    groupWeight: number;
    scanDepth: number | null;
    caseSensitive: boolean | null;
    matchWholeWords: boolean | null;
    useGroupScoring: boolean | null;
    automationId: string;
    role: number;
    sticky: number | null;
    cooldown: number | null;
    delay: number | null;
    [key: string]: unknown;
}

export interface WorldInfo {
    name?: string;
    entries: Record<string, WorldInfoEntry>;
    extensions?: Record<string, unknown>;
}

/** 世界书列表项（管理端返回） */
export interface AdminWorldItem {
    file_id: string;
    name: string;
    entriesCount: number;
    extensions: Record<string, unknown>;
}
