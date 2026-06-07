/**
 * SimpleTavern Service Worker
 *
 * 缓存策略:
 * - 安装阶段预缓存关键静态资源（离线可用）
 * - Stale-While-Revalidate: API 数据（先返回缓存，后台静默更新）
 * - Cache-First: 不变数据（缓存优先，未命中才请求）
 * - Network-First: 实时数据（网络优先，离线降级到缓存）
 */

const BUILD_VERSION = '2026-05-30-2';
const CACHE_NAME = 'simpletavern-' + BUILD_VERSION;

// ─── 预缓存资源清单（安装时全部缓存）───
const PRECACHE_ASSETS = [
  '/',
  '/yuzuai_logo.png',
  '/manifest.json',
];

// ─── 生命周期事件 ───

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 预缓存关键静态资源
      await Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-store' }).then((response) => {
            if (response.ok) {
              cache.put(url, response);
            }
          }).catch(() => {
            // 预缓存失败不阻塞安装
          }),
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
    // 非 JSON 数据，显示简单通知
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
      // 如果已有打开的窗口，聚焦它
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          return;
        }
      }
      // 否则打开新窗口
      if (self.clients.openWindow) {
        self.clients.openWindow(url);
      }
    }),
  );
});

// ─── 请求拦截 ───

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // sw.js 本身永不缓存
  if (url.pathname === '/sw.js') return;

  // 静态资源（JS/CSS/图片/字体）→ Stale-While-Revalidate
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // HTML 导航请求 → Network-First（确保获取最新应用壳）
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(handleApiRequest(request, url.pathname));
});

// ─── 工具函数 ───

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|webp)(\?|$)/.test(pathname);
}

async function handleApiRequest(request, pathname) {
  if (matchRoute(pathname, ['/api/discover', '/api/users/settings'])) {
    return staleWhileRevalidate(request);
  }
  // /api/users/me 必须用 networkFirst，避免退出登录后返回缓存的旧会话数据
  if (matchRoute(pathname, ['/api/users/me'])) {
    return networkFirst(request);
  }
  if (matchRoute(pathname, ['/api/chat/providers', '/api/version'])) {
    return cacheFirst(request);
  }
  if (matchRoute(pathname, ['/api/users/favorites', '/api/users/characters', '/api/chat/threads'])) {
    return networkFirst(request);
  }
  return fetch(request);
}

function matchRoute(pathname, routes) {
  return routes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

// ─── 缓存策略实现 ───

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);
  return cached || fetchPromise;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
