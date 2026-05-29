/**
 * 数据模型类型
 * 与原始 SillyTavern 的 User 对象兼容
 */

export interface User {
    handle: string;
    name: string;
    created: number;
    password: string;
    salt: string;
    enabled: boolean;
    admin: boolean;
    googleId?: string; // Google OAuth subject id
}

export interface UserViewModel {
    handle: string;
    name: string;
    created: number;
    avatar: string;
    admin: boolean;
    password: boolean;
    enabled?: boolean;
}

export interface UserDirectoryList {
    root: string;
    thumbnails: string;
    worlds: string;
    user: string;
    avatars: string;
    userImages: string;
    groups: string;
    chats: string;
    characters: string;
    backgrounds: string;
    [key: string]: string;
}

export interface AuthSession {
    handle?: string;
    csrfToken?: string;
    version?: string;
    touch?: number;
}

export interface RequestUser {
    profile: User;
    directories: UserDirectoryList;
}
