/**
 * SimpleTavern Service Worker
 *
 * 缓存策略:
 * - Stale-While-Revalidate: 先返回缓存，后台静默更新（适合变化不频繁的数据）
 * - Cache-First: 缓存优先，未命中才请求网络（适合几乎不变的资源）
 * - Network-First: 网络优先，离线时返回缓存（适合需要最新但可降级的数据）
 */

const CACHE_NAME = 'simpletavern-v1';

// 路由 → 缓存策略映射
const ROUTES = {
  staleWhileRevalidate: [
    '/api/discover',
    '/api/users/me',
    '/api/users/settings',
  ],
  cacheFirst: [
    '/api/chat/providers',
    '/api/version',
  ],
  networkFirst: [
    '/api/users/favorites',
    '/api/users/characters',
    '/api/chat/threads',
  ],
};

// ─── 生命周期事件 ───

self.addEventListener('install', () => {
  // 跳过等待，立即激活
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 清理旧版本缓存
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  // 立即接管所有页面
  self.clients.claim();
});

// ─── 请求拦截 ───

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 只拦截 GET 请求
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 只处理同源请求
  if (url.origin !== self.location.origin) return;

  // 静态资源（JS/CSS/图片/字体）→ Cache-First
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API 路由匹配
  if (matchRoute(url.pathname, ROUTES.staleWhileRevalidate)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (matchRoute(url.pathname, ROUTES.cacheFirst)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (matchRoute(url.pathname, ROUTES.networkFirst)) {
    event.respondWith(networkFirst(request));
    return;
  }

  // 其他请求不拦截，走浏览器默认行为
});

// ─── 工具函数 ───

function matchRoute(pathname, routes) {
  return routes.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ttf|eot|ico|webp)(\?|$)/.test(pathname);
}

// ─── 缓存策略实现 ───

/**
 * Stale-While-Revalidate
 * 有缓存就立即返回，同时后台发请求更新缓存
 * 用户永远不需要等网络
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // 后台静默更新（不阻塞当前响应）
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => {
      // 网络失败静默，用户已看到缓存内容
    });

  // 有缓存立即返回，否则等网络
  return cached || fetchPromise;
}

/**
 * Cache-First
 * 缓存命中直接返回，未命中才请求网络
 * 适合极少变化的资源
 */
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

/**
 * Network-First
 * 优先网络获取最新数据，网络失败时降级到缓存
 * 适合需要新鲜度但离线时可降级的数据
 */
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
