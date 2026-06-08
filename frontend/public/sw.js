/**
 * SimpleTavern Service Worker — 精简版
 *
 * 策略：只缓存静态资源（图片/JS/CSS/字体），API 数据一律不缓存，保证数据实时性。
 */

const BUILD_VERSION = '2026-05-30-2';
const CACHE_NAME = 'simpletavern-' + BUILD_VERSION;

// ─── 预缓存资源清单 ───
const PRECACHE_ASSETS = [
  '/',
  '/yuzuai_logo.png',
  '/manifest.json',
];

// ─── 生命周期 ───

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-store' }).then((response) => {
            if (response.ok) cache.put(url, response);
          }).catch(() => {}),
        ),
      );
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('simpletavern-'))
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// ─── Push 通知 ───

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Yuzu AI';
    const options = {
      body: data.body || '',
      icon: '/yuzuai_logo.png',
      badge: '/yuzuai_logo.png',
      data: data.url || '/',
      tag: data.tag || 'simpletavern',
      requireInteraction: data.requireInteraction || false,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch {
    event.waitUntil(
      self.registration.showNotification('Yuzu AI', {
        body: event.data.text(),
        icon: '/yuzuai_logo.png',
      }),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      if (self.clients.openWindow) {
        self.clients.openWindow(url);
      }
    }),
  );
});

// ─── 请求拦截：只缓存静态资源 ───

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // sw.js 自身永不缓存
  if (url.pathname === '/sw.js') return;

  // 静态资源 → Cache-First（图片/JS/CSS/字体）
  if (/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|webp)(\?|$)/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 预缓存的 HTML/清单
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API 和其他请求 → 直接穿透，不缓存
});

// ─── 缓存策略 ───

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
