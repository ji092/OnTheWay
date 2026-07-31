/* On The Way service worker.
 *
 * Strategy:
 *   - navigations  : network-first, falling back to the cached shell / offline page
 *   - /_next/static: cache-first (content-hashed, so never stale)
 *   - /api/*       : network-only (route results depend on live traffic data)
 *
 * Bump CACHE_VERSION whenever the precached shell needs to be refreshed.
 */
const CACHE_VERSION = "v1";
const CACHE = `on-the-way-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

// Only the offline shell is precached. Icons are deliberately left to the HTTP
// cache so replacing them in a later deploy takes effect without a version bump.
const PRECACHE = [OFFLINE_URL];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Individual failures must not abort the whole install.
      await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

// Lets a freshly installed worker take over as soon as the page asks it to.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Kakao/Naver SDK, tiles, etc.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Content-hashed build assets only — safe to serve from cache indefinitely.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) ?? (await cache.match(OFFLINE_URL)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}
