/* GoBert service worker: offline shell, runtime caching, background sync for queued bookings. */
const CACHE = "gobert-v1";
const SHELL = ["/", "/fr", "/en"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// network-first for navigation + API, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // navigation: network-first, fall back to cached page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/fr"))),
    );
    return;
  }

  // static assets: cache-first
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon") || url.pathname.endsWith(".png") || url.pathname.endsWith(".jpg")) {
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
  if (url.pathname.startsWith("/api/mock")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req)),
    );
    return;
  }
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
    const req = indexedDB.open("gobert", 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("outbox")) {
        req.result.createObjectStore("outbox", { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}