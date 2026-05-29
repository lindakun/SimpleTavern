/**
 * Google OAuth 2.0 弹窗登录工具
 * 使用 Implicit Flow（id_token 方式），无需后端授权码交换
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface GoogleOAuthResult {
  idToken: string;
}

/**
 * 打开 Google OAuth 弹窗
 * @param onSuccess 登录成功回调，接收 idToken
 * @param onCancel 用户关闭弹窗/取消登录回调
 */
export function openGoogleOAuthPopup(
  onSuccess: (result: GoogleOAuthResult) => void,
  onCancel: () => void,
): void {
  if (!GOOGLE_CLIENT_ID) {
    console.error('[GoogleOAuth] VITE_GOOGLE_CLIENT_ID is not configured');
    return;
  }

  const redirectUri = `${window.location.origin}/auth/google/callback`;
  const nonce = generateNonce();

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('nonce', nonce);

  const width = 500;
  const height = 600;
  const left = (window.innerWidth - width) / 2 + window.screenX;
  const top = (window.innerHeight - height) / 2 + window.screenY;

  const popup = window.open(
    authUrl.toString(),
    'google-login',
    `width=${width},height=${height},left=${left},top=${top}`,
  );

  if (!popup) {
    console.error('[GoogleOAuth] Popup blocked by browser');
    return;
  }

  // 监听成功回调
  const messageHandler = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) return;

    if (event.data?.type === 'google-login-success') {
      cleanup();
      onSuccess({ idToken: event.data.idToken });
    } else if (event.data?.type === 'google-login-error') {
      cleanup();
      console.error('[GoogleOAuth] Error from callback:', event.data.error);
      onCancel();
    }
  };

  // 监听弹窗关闭（用户取消）
  let checkInterval: ReturnType<typeof setInterval>;
  const checkClosed = () => {
    if (popup.closed) {
      cleanup();
      onCancel();
    }
  };
  checkInterval = setInterval(checkClosed, 500);

  const cleanup = () => {
    clearInterval(checkInterval);
    window.removeEventListener('message', messageHandler);
  };

  window.addEventListener('message', messageHandler);
}
