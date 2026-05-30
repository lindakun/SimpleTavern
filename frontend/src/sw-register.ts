/**
 * Service Worker 注册
 *
 * 生产环境注册 SW，开发环境跳过（避免缓存干扰热重载）
 */

export function registerServiceWorker() {
  if (import.meta.env.DEV) return;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          // 检查是否有新版本待激活
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'activated' &&
                  navigator.serviceWorker.controller
                ) {
                  // 新 SW 已激活，可提示用户刷新（暂不实现）
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('SW 注册失败:', err);
        });
    });
  }
}
