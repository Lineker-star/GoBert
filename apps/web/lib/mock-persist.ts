// Disk persistence for the in-memory mock backend, so demo data (registered
// users, riders, businesses, bookings) survives dev-server restarts.
// Server-only. Silently disabled when the filesystem is read-only (e.g. Vercel)
// or during tests.
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), ".mock-data");
const FILE = path.join(DIR, "gobert.json");

function enabled(): boolean {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return false;
  return process.env.GOBERT_MOCK_PERSIST !== "false";
}

export function loadPersisted<T>(): T | null {
  if (!enabled()) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8")) as T;
  } catch {
    return null;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function persist(state: unknown): void {
  if (!enabled()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(state));
    } catch {
      // read-only filesystem: keep in memory only
    }
  }, 250);
}
