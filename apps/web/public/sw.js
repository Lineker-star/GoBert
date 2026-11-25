/* GoBert service worker: offline shell, runtime caching, background sync for queued bookings. */
const CACHE = "gobert-v2";
const SHELL = ["/", "/fr", "/en", "/manifest.json", "/icon-192.svg", "/icon-512.svg", "/icon-maskable.svg"];

const API_CACHE = "gobert-api-v1";
const MAX_API_CACHE_ENTRIES = 50;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE && k !== API_CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Helper: check if request is for same-origin
function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

// Helper: check if request is an API call
function isAPI(url) {
  return url.pathname.startsWith("/api/");
}

// Helper: check if request is for static assets
function isStatic(url) {
  return (
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/icon") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!isSameOrigin(url)) return;

  // Navigation: network-first, fall back to cached page or /fr
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match("/fr")),
        ),
    );
    return;
  }

  // Static assets: cache-first
  if (isStatic(url)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        });
      }),
    );
    return;
  }

  // API calls: network-first with cache fallback
  if (isAPI(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(API_CACHE).then((c) => {
              c.put(req, copy).then(() => {
                // Prune old entries
                c.keys().then((keys) => {
                  if (keys.length > MAX_API_CACHE_ENTRIES) {
                    keys.sort((a, b) => new Date(b.url) - new Date(a.url));
                    c.delete(keys[0]);
                  }
                });
              });
            });
          }
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }

  // Other GET requests: network-first, fall back to cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req)),
  );
});

// background sync: replay queued bookings from IndexedDB outbox
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-bookings") {
    event.waitUntil(syncOutbox());
  }
});

async function syncOutbox() {
  const db = await openDB();
  const entries = await new Promise((resolve) => {
    const tx = db.transaction("outbox", "readonly");
    const req = tx.objectStore("outbox").getAll();
    req.onsuccess = () => resolve(req.result || []);
  });
  for (const entry of entries) {
    try {
      await fetch(entry.url, {
        method: entry.method || "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.body),
      });
      await new Promise((resolve) => {
        const tx = db.transaction("outbox", "readwrite");
        tx.objectStore("outbox").delete(entry.id);
        tx.oncomplete = () => resolve();
      });
    } catch {
      // keep in outbox for next sync
    }
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gobert", 2);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
