/**
 * 管理后台类型定义
 */

/**
 * 角色来源类型
 */
export type CharacterSource = 'seed' | 'published' | 'file';

/**
 * 管理员视图中的角色数据
 * 统一种子角色、用户发布角色、文件角色的展示格式
 */
export interface AdminCharacterView {
    /** 角色名称 */
    name: string;
    /** 角色描述 */
    description?: string;
    /** 角色头像（相对路径） */
    avatar?: string;
    /** 创建者标识 */
    _owner: string;
    /** 文件名（文件角色才有） */
    _fileName: string;
    /** 角色来源 */
    _source: CharacterSource;
    /** 创建时间 */
    created?: number;
    /** 最后修改时间 */
    lastModified?: number;
    /** 创建者用户名（文件角色） */
    user_name?: string;
    /** 原始数据 */
    _rawData?: Record<string, unknown>;
}

/**
 * 管理员用户视图
 */
export interface AdminUserView {
    /** 用户 handle */
    handle: string;
    /** 显示名称 */
    name: string;
    /** 是否启用 */
    enabled: boolean;
    /** 是否管理员 */
    admin: boolean;
    /** 创建时间 */
    created: number;
    /** 角色数量 */
    characterCount?: number;
}

/**
 * 管理员世界书视图
 */
export interface AdminWorldView {
    /** 世界书名称 */
    name: string;
    /** 文件名 */
    fileName: string;
    /** 条目数量 */
    entryCount?: number;
    /** 创建者 */
    owner?: string;
    /** 最后修改时间 */
    lastModified?: number;
}

/**
 * 管理员统计信息
 */
export interface AdminStats {
    /** 用户总数 */
    totalUsers: number;
    /** 角色总数 */
    totalCharacters: number;
    /** 种子角色数量 */
    seedCharacters: number;
    /** 用户发布角色数量 */
    publishedCharacters: number;
    /** 文件角色数量 */
    fileCharacters: number;
    /** 世界书数量 */
    totalWorlds: number;
}
