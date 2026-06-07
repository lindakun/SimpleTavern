/**
 * Service Worker 注册 & PWA 功能
 *
 * - 生产环境注册 SW
 * - beforeinstallprompt 安装提示
 * - Push Notification 权限请求
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installPromptShown = false;

/** 监听 beforeinstallprompt 事件，捕获安装提示 */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });

  // 用户成功安装后清理
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installPromptShown = false;
  });
}

/** 触发 PWA 安装提示（可在 UI 中调用） */
export async function showInstallPrompt(): Promise<boolean> {
  if (!deferredPrompt || installPromptShown) return false;

  installPromptShown = true;
  await deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;

  return outcome === 'accepted';
}

/** 检查是否已安装为 PWA */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** 请求推送通知权限 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** 注册 Push Subscription（需要后端支持 VAPID） */
export async function subscribePush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  try {
    // VAPID public key — 需要后端提供，此处留空
    const vapidPublicKey = '';
    if (!vapidPublicKey) return null;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey
        ? urlBase64ToUint8Array(vapidPublicKey)
        : undefined,
    });
    return subscription;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** 注册 Service Worker */
export function registerServiceWorker() {
  if (import.meta.env.DEV) return;

  if ('serviceWorker' in navigator) {
    // 页面可能已加载完毕，直接注册而非等 load 事件
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        // 注册成功后初始化 PWA 功能
        setupInstallPrompt();
      })
      .catch((err) => {
        console.warn('SW 注册失败:', err);
      });
  }
}
