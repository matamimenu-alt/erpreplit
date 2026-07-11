// Service worker for the Restaurant Management PWA.
// Strategy:
//   - Navigations (the app shell)  -> network-first, fall back to cached index.html when offline.
//     This guarantees users always get the latest deployed build the moment they are online.
//   - Hashed static assets (JS/CSS/img/fonts) -> cache-first (filenames are content-hashed,
//     so a cached entry is always correct; new builds produce new names).
//   - API requests (/api/*) and any non-GET -> never touched; always go straight to the network
//     so ERP data is never served stale.
const CACHE = "matami-cache-v1";
const APP_SHELL = "/index.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept API traffic — always live from the network.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api")) return;

  // App shell / client-side routes: network-first for freshness.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(APP_SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(APP_SHELL).then((r) => r || Response.error())),
    );
    return;
  }

  // Static assets: cache-first (content-hashed, safe to cache indefinitely).
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && (res.type === "basic" || res.type === "cors")) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
    }),
  );
});
