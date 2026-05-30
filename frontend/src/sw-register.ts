/**
 * Service Worker 注册
 *
 * 生产环境注册 SW，开发环境跳过（避免缓存干扰热重载）
 */

export function registerServiceWorker() {
  if (import.meta.env.DEV) return;

  if ('serviceWorker' in navigator) {
    // 页面可能已加载完毕，直接注册而非等 load 事件
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => {
        console.warn('SW 注册失败:', err);
      });
  }
}
