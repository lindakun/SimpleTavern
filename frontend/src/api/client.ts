/**
 * 统一 API 客户端
 *
 * 功能:
 * - 统一请求/响应处理
 * - 自动错误处理与 Toast 提示
 * - 请求超时控制
 * - CSRF Token 自动附加
 * - 请求重试机制
 */

import { useToast } from '../components/Toast';

// ── CSRF Token 缓存 ──
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string | null> | null = null;

async function getCsrfToken(): Promise<string | null> {
    if (csrfToken !== null) return csrfToken;
    if (csrfTokenPromise) return csrfTokenPromise;

    csrfTokenPromise = fetch('/csrf-token', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            const token = data?.token;
            if (token && token !== 'disabled') {
                csrfToken = token;
                return token;
            }
            return null;
        })
        .catch(() => null)
        .finally(() => { csrfTokenPromise = null; });

    return csrfTokenPromise;
}

/** 清除缓存的 CSRF token（401 / 退出登录时调用） */
function clearCsrfToken() {
    csrfToken = null;
}

// 401 全局回调忽略的端点：这些端点返回 401 表示操作失败（如凭证错误），非 session 过期
const AUTH_EXEMPT_PATHS = new Set([
    '/api/users/login',
    '/api/users/google-login',
]);

// 401 全局回调：当任意 API 返回 401 时触发，用于强制跳转登录页
let onUnauthorizedCallback: (() => void) | null = null;

/**
 * 注册 401 未授权回调（由 App.tsx 调用）
 */
export function registerUnauthorizedCallback(cb: () => void) {
    onUnauthorizedCallback = cb;
}

// API 响应类型
export interface ApiResponse<T = unknown> {
    data?: T;
    error?: string;
    message?: string;
}

// 请求配置
interface RequestConfig extends RequestInit {
    timeout?: number;
    retry?: number;
    showError?: boolean; // 是否自动显示错误 Toast
}

// 自定义 API 错误
export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public data?: unknown,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// 默认超时时间 (ms)
const DEFAULT_TIMEOUT = 30000;

/** 不需要 CSRF token 的 HTTP 方法 */
const CSRF_EXEMPT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * 创建 API 客户端
 * 需要在组件内部调用（因为使用了 useToast hook）
 */
export function useApiClient() {
    const { showToast } = useToast();

    /**
     * 核心请求方法
     */
    async function request<T>(url: string, config: RequestConfig = {}): Promise<T> {
        const {
            timeout = DEFAULT_TIMEOUT,
            retry = 0,
            showError = true,
            ...fetchConfig
        } = config;

        // 设置默认 headers
        const headers = new Headers(fetchConfig.headers);
        // FormData 上传时不设置 Content-Type，让浏览器自动设置 multipart boundary
        if (!headers.has('Content-Type') && fetchConfig.body && !(fetchConfig.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        // 为状态变更方法附加 CSRF token
        const method = (fetchConfig.method || 'GET').toUpperCase();
        if (!CSRF_EXEMPT_METHODS.has(method) && !headers.has('x-csrf-token')) {
            const token = await getCsrfToken();
            if (token) {
                headers.set('x-csrf-token', token);
            }
        }

        // 创建 AbortController 实现超时
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...fetchConfig,
                headers,
                signal: controller.signal,
                credentials: 'include', // 携带 cookie
            });

            clearTimeout(timeoutId);

            // 解析响应
            let data: unknown;
            const contentType = response.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            // 检查 HTTP 状态码
            if (!response.ok) {
                const errorMessage =
                    (data as any)?.message ||
                    (data as any)?.error ||
                    `请求失败 (${response.status})`;

                throw new ApiError(errorMessage, response.status, data);
            }

            return data as T;
        } catch (error: unknown) {
            clearTimeout(timeoutId);

            // 处理超时
            if (error instanceof DOMException && error.name === 'AbortError') {
                const timeoutError = new ApiError('请求超时，请检查网络连接', 408);
                if (showError) {
                    showToast('请求超时，请检查网络连接', 'error');
                }
                throw timeoutError;
            }

            // 处理 API 错误
            if (error instanceof ApiError) {
                if (error.status === 401) {
                    clearCsrfToken(); // 清除 CSRF token，下次请求重新获取
                    // 认证相关的端点（login/google-login）返回 401 表示操作失败（凭证错误）
                    // 其他端点返回 401 表示 session 过期/无效 → 全局回调跳转登录页
                    if (!AUTH_EXEMPT_PATHS.has(url)) {
                        onUnauthorizedCallback?.();
                    }
                } else if (showError) {
                    showToast(error.message, 'error');
                }
                throw error;
            }

            // 处理网络错误
            const networkError = new ApiError(
                '网络连接失败，请检查网络连接',
                0,
            );
            if (showError) {
                showToast('网络连接失败', 'error');
            }
            throw networkError;
        }
    }

    // 便捷方法
    const get = <T>(url: string, config?: RequestConfig) =>
        request<T>(url, { ...config, method: 'GET' });

    const post = <T>(url: string, body?: unknown, config?: RequestConfig) =>
        request<T>(url, {
            ...config,
            method: 'POST',
            body: body != null ? JSON.stringify(body) : null,
        });

    const put = <T>(url: string, body?: unknown, config?: RequestConfig) =>
        request<T>(url, {
            ...config,
            method: 'PUT',
            body: body != null ? JSON.stringify(body) : null,
        });

    const del = <T>(url: string, config?: RequestConfig) =>
        request<T>(url, { ...config, method: 'DELETE' });

    return {
        request,
        get,
        post,
        put,
        delete: del,
    };
}

// 导出类型
export type ApiClient = ReturnType<typeof useApiClient>;
