/**
 * Google Identity Services (GIS) 登录工具
 *
 * 使用 Google Sign-In (gis/client) 弹窗模式，
 * 返回 JWT credential，由后端验证。
 * 替代已弃用的 Implicit Flow。
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

// GIS 全局类型声明
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: IdConfiguration) => void;
          prompt: (callback?: (notification: PromptMomentNotification) => void) => void;
          disableAutoSelect: () => void;
          revoke: (hint: string, callback: (done: RevocationResult) => void) => void;
        };
      };
    };
  }
}

interface IdConfiguration {
  client_id: string;
  callback: (response: CredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: 'signin' | 'signup' | 'use';
  ux_mode?: 'popup' | 'redirect';
  nonce?: string;
}

interface CredentialResponse {
  credential: string; // JWT ID Token (Base64 编码)
  select_by: string;
}

interface PromptMomentNotification {
  isNotDisplayed: () => boolean;
  isSkippedMoment: () => boolean;
  getNotDisplayedReason: () => string;
  getSkippedReason: () => string;
}

interface RevocationResult {
  successful: boolean;
}

export interface GoogleOAuthResult {
  idToken: string;
}

// GIS SDK 加载状态
let sdkLoadPromise: Promise<void> | null = null;

/**
 * 动态加载 Google Identity Services SDK
 */
function loadGoogleGisSdk(): Promise<void> {
  if (sdkLoadPromise) return sdkLoadPromise;
  if (window.google?.accounts?.id) return Promise.resolve();

  sdkLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkLoadPromise = null;
      reject(new Error('Failed to load Google Identity Services SDK'));
    };
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

/**
 * 使用 Google Identity Services 弹窗登录
 * @param onSuccess 登录成功回调，接收 idToken (JWT)
 * @param onCancel 用户取消登录回调
 */
export async function openGoogleOAuthPopup(
  onSuccess: (result: GoogleOAuthResult) => void,
  onCancel: () => void,
): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    console.error('[GoogleOAuth] VITE_GOOGLE_CLIENT_ID is not configured');
    onCancel();
    return;
  }

  try {
    await loadGoogleGisSdk();
  } catch {
    console.error('[GoogleOAuth] Failed to load GIS SDK');
    onCancel();
    return;
  }

  if (!window.google?.accounts?.id) {
    console.error('[GoogleOAuth] GIS SDK not available');
    onCancel();
    return;
  }

  // 使用一次性初始化：每次点击时重新初始化以绑定当前回调
  // GIS 的 initialize 可以多次调用，只保留最后一次配置
  let callbackFired = false;

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response: CredentialResponse) => {
      if (callbackFired) return;
      callbackFired = true;
      // GIS 返回的 credential 就是 JWT ID Token
      onSuccess({ idToken: response.credential });
    },
    context: 'signin',
    ux_mode: 'popup',
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  // 使用 prompt 触发 One Tap / 弹窗
  // 如果用户之前已同意，prompt 会直接返回 credential
  // 否则会显示账号选择器弹窗
  window.google.accounts.id.prompt((notification) => {
    if (!callbackFired && (notification.isNotDisplayed() || notification.isSkippedMoment())) {
      // One Tap 不可用时，GIS 会自动回退到弹窗模式
      // 但如果完全失败（如第三方 Cookie 被阻止），则取消
      const reason = notification.isNotDisplayed()
        ? notification.getNotDisplayedReason()
        : notification.getSkippedReason();
      console.warn('[GoogleOAuth] Prompt not shown:', reason);
      // 不立即取消——GIS 弹窗可能仍可通过点击触发
    }
  });
}
