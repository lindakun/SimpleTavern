/**
 * Google OAuth 回调页面
 * 从 URL hash 中提取 id_token，通过 postMessage 发送给父窗口
 */
import { useEffect } from 'react';

export default function GoogleCallback() {
  useEffect(() => {
    // Google Implicit Flow 返回 id_token 在 URL hash 中
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get('id_token');
    const error = params.get('error');

    if (idToken && window.opener) {
      window.opener.postMessage(
        { type: 'google-login-success', idToken },
        window.location.origin,
      );
    } else if (error && window.opener) {
      window.opener.postMessage(
        { type: 'google-login-error', error },
        window.location.origin,
      );
    }

    // 关闭弹窗
    window.close();
  }, []);

  return (
    <div className="h-dvh flex items-center justify-center bg-background-deep">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-accent-pink border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-on-surface-variant">正在完成登录...</p>
      </div>
    </div>
  );
}
