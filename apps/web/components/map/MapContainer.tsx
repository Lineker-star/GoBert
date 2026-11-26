"use client";
import { useCallback, useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  size?: "sm" | "md";
  /** "vehicle" draws a small vehicle badge instead of a dot. */
  kind?: "dot" | "vehicle";
  vehicle?: string;
};

type LatLng = { lat: number; lng: number };

interface MapContainerProps {
  center: [number, number];
  zoom: number;
  markers: MapMarker[];
  /** Draggable pickup pin (green). */
  pickup?: LatLng | null;
  /** Destination pin (orange). */
  dropoff?: LatLng | null;
  onPickupDragEnd?: (lat: number, lng: number) => void;
  onDropoffDragEnd?: (lat: number, lng: number) => void;
  /** Tap/click on the map. */
  onMapClick?: (lat: number, lng: number) => void;
  /** Route polyline as [lng, lat] pairs. */
  route?: [number, number][] | null;
  /** Live GPS position of the user. */
  userLocation?: (LatLng & { accuracy?: number }) | null;
  /** When this key changes, the view fits all given points. */
  fitKey?: string;
  fitPoints?: LatLng[];
  onLoad?: () => void;
  className?: string;
}

const VEHICLE_GLYPH: Record<string, string> = { moto: "🏍️", taxi: "🚕", ride: "🚕", tricycle: "🛺", truck: "🚚", cargo: "🚚", express: "📦", rent: "🔑", logistics: "🚚" };

function pinEl(color: string, ring: string) {
  const el = document.createElement("div");
  el.style.cssText = `width:30px;height:40px;cursor:grab;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))`;
  el.innerHTML = `<svg viewBox="0 0 30 40" width="30" height="40"><path d="M15 0C6.7 0 0 6.6 0 14.8 0 26 15 40 15 40s15-14 15-25.2C30 6.6 23.3 0 15 0z" fill="${color}"/><circle cx="15" cy="15" r="6" fill="${ring}"/></svg>`;
  return el;
}

export default function MapContainer({
  center,
  zoom,
  markers,
  pickup,
  dropoff,
  onPickupDragEnd,
  onDropoffDragEnd,
  onMapClick,
  route,
  userLocation,
  fitKey,
  fitPoints,
  onLoad,
  className,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const glRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const markerRefs = useRef<any[]>([]);
  const pickupRef = useRef<any>(null);
  const dropoffRef = useRef<any>(null);
  const userRef = useRef<any>(null);

  const latest = useRef({ markers, pickup, dropoff, route, userLocation, onPickupDragEnd, onDropoffDragEnd, onMapClick, onLoad });
  latest.current = { markers, pickup, dropoff, route, userLocation, onPickupDragEnd, onDropoffDragEnd, onMapClick, onLoad };

  const drawMarkers = useCallback(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    markerRefs.current.forEach((m) => m.remove());
    markerRefs.current = [];
    for (const mk of latest.current.markers) {
      const el = document.createElement("div");
      if (mk.kind === "vehicle") {
        el.style.cssText = `width:30px;height:30px;border-radius:50%;background:#fff;border:2px solid ${mk.color ?? "#087C55"};display:flex;align-items:center;justify-content:center;font-size:15px;box-shadow:0 2px 6px rgba(0,0,0,.3)`;
        el.textContent = VEHICLE_GLYPH[mk.vehicle ?? ""] ?? "🚗";
      } else {
        const s = mk.size === "sm" ? 10 : 16;
        el.style.cssText = `width:${s}px;height:${s}px;border-radius:50%;background:${mk.color ?? "#087C55"};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)`;
      }
      if (mk.label) el.title = mk.label;
      markerRefs.current.push(new gl.Marker({ element: el }).setLngLat([mk.lng, mk.lat]).addTo(map));
    }
  }, []);

  const drawPins = useCallback(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    const { pickup: pu, dropoff: dr } = latest.current;
    if (pu) {
      if (!pickupRef.current) {
        pickupRef.current = new gl.Marker({ element: pinEl("#087C55", "#fff"), anchor: "bottom", draggable: true }).setLngLat([pu.lng, pu.lat]).addTo(map);
        pickupRef.current.on("dragend", () => {
          const ll = pickupRef.current.getLngLat();
          latest.current.onPickupDragEnd?.(ll.lat, ll.lng);
        });
      } else pickupRef.current.setLngLat([pu.lng, pu.lat]);
    } else {
      pickupRef.current?.remove();
      pickupRef.current = null;
    }
    if (dr) {
      if (!dropoffRef.current) {
        dropoffRef.current = new gl.Marker({ element: pinEl("#F28C28", "#fff"), anchor: "bottom", draggable: true }).setLngLat([dr.lng, dr.lat]).addTo(map);
        dropoffRef.current.on("dragend", () => {
          const ll = dropoffRef.current.getLngLat();
          latest.current.onDropoffDragEnd?.(ll.lat, ll.lng);
        });
      } else dropoffRef.current.setLngLat([dr.lng, dr.lat]);
    } else {
      dropoffRef.current?.remove();
      dropoffRef.current = null;
    }
  }, []);

  const drawUser = useCallback(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    const u = latest.current.userLocation;
    if (!u) {
      userRef.current?.remove();
      userRef.current = null;
      return;
    }
    if (!userRef.current) {
      const el = document.createElement("div");
      el.style.cssText = "width:18px;height:18px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,.22),0 1px 4px rgba(0,0,0,.35)";
      el.title = "GPS";
      userRef.current = new gl.Marker({ element: el }).setLngLat([u.lng, u.lat]).addTo(map);
    } else userRef.current.setLngLat([u.lng, u.lat]);
  }, []);

  const drawRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const coords = latest.current.route;
    const data = { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords && coords.length > 1 ? coords : [] } };
    const src = map.getSource("route");
    if (src) src.setData(data);
    else {
      map.addSource("route", { type: "geojson", data });
      map.addLayer({ id: "route-casing", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#123D32", "line-width": 8, "line-opacity": 0.35 } });
      map.addLayer({ id: "route-line", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#087C55", "line-width": 5 } });
    }
  }, []);

  useEffect(() => {
    let map: any;
    let cancelled = false;
    (async () => {
      const gl = (await import("maplibre-gl")) as any;
      if (cancelled || !containerRef.current) return;
      glRef.current = gl;
      if (typeof gl.setWorkerUrl === "function") gl.setWorkerUrl("/maplibre-gl-worker.mjs");
      map = new gl.Map({
        container: containerRef.current,
        center,
        zoom,
        style: { version: 8, sources: {}, layers: [] },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("load", () => {
        map.addSource("osm", { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap" });
        map.addLayer({ id: "osm", type: "raster", source: "osm" });
        loadedRef.current = true;
        drawRoute();
        drawMarkers();
        drawPins();
        drawUser();
        latest.current.onLoad?.();
      });
      map.on("click", (e: any) => latest.current.onMapClick?.(e.lngLat.lat, e.lngLat.lng));
    })();
    return () => {
      cancelled = true;
      loadedRef.current = false;
      markerRefs.current.forEach((m) => m.remove());
      markerRefs.current = [];
      pickupRef.current = dropoffRef.current = userRef.current = null;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(drawMarkers, [markers, drawMarkers]);
  useEffect(drawPins, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, drawPins]);
  useEffect(drawUser, [userLocation?.lat, userLocation?.lng, drawUser]);
  useEffect(drawRoute, [route, drawRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && !fitKey) map.easeTo({ center, zoom, duration: 600 });
  }, [center, zoom, fitKey]);

  useEffect(() => {
    const map = mapRef.current;
    const gl = glRef.current;
    const pts = (fitPoints ?? []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!map || !gl || !fitKey || pts.length === 0) return;
    if (pts.length === 1) return void map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, duration: 600 });
    const b = new gl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]);
    pts.forEach((p) => b.extend([p.lng, p.lat]));
    const wide = (containerRef.current?.clientWidth ?? 0) > 900;
    map.fitBounds(b, { padding: { top: 90, bottom: wide ? 90 : 340, left: wide ? 460 : 50, right: 60 }, maxZoom: 16, duration: 700 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  return <div ref={containerRef} className={className} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}
