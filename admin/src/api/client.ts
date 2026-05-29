/**
 * API 客户端（精简版，不含 Toast 依赖）
 */

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

interface RequestConfig extends RequestInit {
  timeout?: number;
}

const DEFAULT_TIMEOUT = 15000;

export async function apiRequest<T>(
  url: string,
  config: RequestConfig = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchConfig } = config;

  const headers = new Headers(fetchConfig.headers);
  if (!headers.has('Content-Type') && fetchConfig.body) {
    headers.set('Content-Type', 'application/json');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchConfig,
      headers,
      signal: controller.signal,
      credentials: 'include',
    });

    clearTimeout(timeoutId);

    let data: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

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

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('请求超时', 408);
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError('网络连接失败', 0);
  }
}

// 便捷方法
export const api = {
  get: <T>(url: string) => apiRequest<T>(url, { method: 'GET' }),

  post: <T>(url: string, body?: unknown) =>
    apiRequest<T>(url, {
      method: 'POST',
      body: body != null ? JSON.stringify(body) : null,
    }),

  del: <T>(url: string) =>
    apiRequest<T>(url, { method: 'DELETE' }),

  // 文件上传（multipart/form-data）
  upload: <T>(url: string, file: File, fieldName = 'file') => {
    const formData = new FormData();
    formData.append(fieldName, file);
    return apiRequest<T>(url, {
      method: 'POST',
      body: formData,
      // 不设置 Content-Type，让浏览器自动加 boundary
      headers: {},
    });
  },
};
