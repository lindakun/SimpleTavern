/**
 * API 请求/响应类型
 */

// 响应包装
export interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
    message?: string;
}

export interface CsrfTokenResponse {
    token: string;
}

export interface LoginRequest {
    handle: string;
    password?: string;
}

export interface LoginResponse {
    handle: string;
}

export interface UserRecoverStep1Request {
    handle: string;
}

export interface UserRecoverStep2Request {
    handle: string;
    code: string;
    newPassword?: string;
}

export interface ChangePasswordRequest {
    handle: string;
    oldPassword?: string;
    newPassword?: string;
}

export interface ChangeNameRequest {
    handle: string;
    name: string;
}

export interface ChangeAvatarRequest {
    handle: string;
    avatar: string;
}

export interface UserBackupRequest {
    handle: string;
}

export interface ResetStep2Request {
    code: string;
    password?: string;
}

export interface AdminCreateUserRequest {
    handle: string;
    name?: string;
    password?: string;
    admin?: boolean;
}

export interface AdminUserActionRequest {
    handle: string;
    purge?: boolean;
}

export interface AdminSlugifyRequest {
    text: string;
}
