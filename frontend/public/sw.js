/**
 * SimpleTavern Service Worker
 *
 * 缓存策略:
 * - Stale-While-Revalidate: 先返回缓存，后台静默更新
 * - Cache-First: 缓存优先，未命中才请求网络
 * - Network-First: 网络优先，离线时返回缓存
 */

const BUILD_VERSION = '2026-05-30-2';
const CACHE_NAME = 'simpletavern-' + BUILD_VERSION;

// ─── 生命周期事件 ───

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key.startsWith('simpletavern-'))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
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
  // ⚠️ 不能使用 Cache-First：部署后 chunk 文件名(hash)变更，
  //    Cache-First 会用旧 app shell 引用已不存在的旧 chunk 名 → 动态导入失败
  if (isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  event.respondWith(handleApiRequest(request, url.pathname));
});

// ─── 工具函数 ───

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|webp)(\?|$)/.test(pathname);
}

async function handleApiRequest(request, pathname) {
  if (matchRoute(pathname, ['/api/discover', '/api/users/me', '/api/users/settings'])) {
    return staleWhileRevalidate(request);
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
