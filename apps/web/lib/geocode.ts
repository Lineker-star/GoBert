const CACHE_KEY = "gobert:geocode";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface GeoCacheEntry {
  label: string;
  lat: number;
  lng: number;
  ts: number;
}

const memCache = new Map<string, GeoCacheEntry>();

function loadDiskCache(): Map<string, GeoCacheEntry> {
  const disk = new Map<string, GeoCacheEntry>();
  if (typeof localStorage === "undefined") return disk;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, GeoCacheEntry>;
      const now = Date.now();
      for (const [k, v] of Object.entries(parsed)) {
        if (now - v.ts < TTL_MS) disk.set(k, v);
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return disk;
}

const diskCache = loadDiskCache();

function persist() {
  if (typeof localStorage === "undefined") return;
  try {
    const obj: Record<string, GeoCacheEntry> = {};
    for (const [k, v] of diskCache) obj[k] = v;
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
}

function keyOf(lat: number, lng: number) {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

export function getCachedLabel(lat: number, lng: number): string | null {
  const k = keyOf(lat, lng);
  if (memCache.has(k)) return memCache.get(k)!.label;
  if (diskCache.has(k)) {
    const v = diskCache.get(k)!;
    memCache.set(k, v);
    return v.label;
  }
  return null;
}

function setCachedLabel(lat: number, lng: number, label: string) {
  const k = keyOf(lat, lng);
  const entry: GeoCacheEntry = { label, lat, lng, ts: Date.now() };
  memCache.set(k, entry);
  diskCache.set(k, entry);
  persist();
}

export type Place = {
  lat: number;
  lng: number;
  label: string;
  address?: string;
  source?: "photon" | "nominatim";
};

const USER_AGENT = "GoBert/1.0 (passenger app; contact: ops@gobert.cm)";

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "fr,en" },
  });
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  return res.json();
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  lang = "fr",
): Promise<string | null> {
  const cached = getCachedLabel(lat, lng);
  if (cached) return cached;

  try {
    const data = await fetchJson(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&accept-language=${lang}`,
    );
    const label = data?.display_name || data?.address?.city || data?.address?.town || null;
    if (label) {
      setCachedLabel(lat, lng, label);
    }
    return label;
  } catch {
    return null;
  }
}

export async function searchPlaces(
  q: string,
  near: { lat: number; lng: number },
  lang = "fr",
): Promise<Place[]> {
  if (!q.trim()) return [];

  // Primary: Photon (location-biased, built for search)
  try {
    const data = await fetchJson(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${near.lat}&lon=${near.lng}&limit=8&lang=${lang}`,
    );
    const places: Place[] = (data?.features ?? []).map((f: any) => {
      const p = f.properties ?? {};
      const coords = f.geometry?.coordinates ?? [0, 0];
      const label = p.name || p.city || p.state || q;
      const address = [p.street, p.city, p.country].filter(Boolean).join(", ");
      return {
        lat: coords[1],
        lng: coords[0],
        label,
        address: address || undefined,
        source: "photon",
      };
    });
    if (places.length) return places;
  } catch {
    // fall through to Nominatim
  }

  // Fallback: Nominatim search bounded near Bertoua
  try {
    const data = await fetchJson(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&viewbox=${near.lng - 0.2},${near.lat + 0.2},${near.lng + 0.2},${near.lat - 0.2}&bounded=1&accept-language=${lang}&limit=8`,
    );
    return (data ?? []).map((d: any) => ({
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      label: d.display_name || q,
      address: d.display_name,
      source: "nominatim",
    }));
  } catch {
    return [];
  }
}
