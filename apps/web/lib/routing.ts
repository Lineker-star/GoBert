// Road routing via OSRM (OpenStreetMap). Configure your own server with
// NEXT_PUBLIC_OSRM_URL in production — the public demo server is for light use only.
const OSRM = process.env.NEXT_PUBLIC_OSRM_URL || "https://router.project-osrm.org";

export type Route = {
  coordinates: [number, number][]; // [lng, lat]
  distance_m: number;
  duration_s: number;
  /** false when we fell back to a straight line (router unreachable). */
  road: boolean;
};

type LatLng = { lat: number; lng: number };

function straight(a: LatLng, b: LatLng): Route {
  const R = 6371000;
  const rad = (v: number) => (v * Math.PI) / 180;
  const s = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  const d = 2 * R * Math.asin(Math.sqrt(s));
  return { coordinates: [[a.lng, a.lat], [b.lng, b.lat]], distance_m: Math.round(d * 1.25), duration_s: Math.round((d * 1.25) / 7), road: false };
}

const cache = new Map<string, Route>();

export async function getRoute(a: LatLng, b: LatLng, signal?: AbortSignal): Promise<Route> {
  const key = [a.lat, a.lng, b.lat, b.lng].map((n) => n.toFixed(5)).join(",");
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const url = `${OSRM}/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    signal?.addEventListener("abort", () => ctrl.abort());
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const r = data.routes?.[0];
    if (!r) throw new Error("no route");
    const route: Route = { coordinates: r.geometry.coordinates, distance_m: Math.round(r.distance), duration_s: Math.round(r.duration), road: true };
    cache.set(key, route);
    return route;
  } catch {
    return straight(a, b);
  }
}
