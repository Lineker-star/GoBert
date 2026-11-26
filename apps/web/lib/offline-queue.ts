// IndexedDB outbox for queued bookings + background sync registration.
const DB = "gobert";
const STORE = "outbox";

type OutboxEntry = { id: string; url: string; method: string; body: unknown; created_at: number };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // Must match the version used in public/sw.js, otherwise open() throws VersionError.
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function queueRequest(entry: { url: string; method: string; body: unknown }): Promise<void> {
  const db = await openDB();
  const record: OutboxEntry = { id: crypto.randomUUID(), created_at: Date.now(), ...entry };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  registerBackgroundSync();
}

export async function getOutbox(): Promise<OutboxEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function flushOutbox(): Promise<number> {
  const entries = await getOutbox();
  let flushed = 0;
  for (const entry of entries) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.body),
      });
      if (res.ok) {
        const db = await openDB();
        await new Promise<void>((resolve) => {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).delete(entry.id);
          tx.oncomplete = () => resolve();
        });
        flushed++;
      }
    } catch {
      // keep for next attempt
    }
  }
  return flushed;
}

export async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sync = (reg as any).sync;
    if (sync) await sync.register("sync-bookings");
  } catch {
    // background sync not supported
  }
}