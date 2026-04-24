const STATIC_CACHE = "myboard-static-v4";
const RUNTIME_CACHE = "myboard-runtime-v4";
const OFFLINE_URL = "/";

const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/privacy",
  "/library",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE && key !== RUNTIME_CACHE) {
            return caches.delete(key);
          }
          return Promise.resolve();
        }),
      ),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  const staleWhileRevalidate = async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);

    const networkPromise = fetch(request)
      .then((response) => {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null);

    // Мгновенный UI из кэша + обновление в фоне.
    if (cached) {
      event.waitUntil(networkPromise);
      return cached;
    }

    const networkResponse = await networkPromise;
    if (networkResponse) {
      return networkResponse;
    }

    if (request.mode === "navigate") {
      return (await caches.match(OFFLINE_URL)) || Response.error();
    }
    return (await caches.match("/icon-192.png")) || Response.error();
  };

  event.respondWith(staleWhileRevalidate());
});
