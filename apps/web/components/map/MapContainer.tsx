"use client";
import { useEffect, useRef, useCallback } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  size?: "sm" | "md";
};

interface MapContainerProps {
  center: [number, number];
  zoom: number;
  markers: MapMarker[];
  pickup?: { lat: number; lng: number } | null;
  onPickupDragEnd?: (lat: number, lng: number) => void;
  onLoad?: () => void;
  className?: string;
}

export default function MapContainer({
  center,
  zoom,
  markers,
  pickup,
  onPickupDragEnd,
  onLoad,
  className,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const glRef = useRef<any>(null);
  const markerInstancesRef = useRef<any[]>([]);
  const pickupInstanceRef = useRef<any>(null);

  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  const markersLatest = useRef(markers);
  markersLatest.current = markers;
  const pickupLatest = useRef<{
    pu: { lat: number; lng: number } | null | undefined;
    onDrag?: (lat: number, lng: number) => void;
  }>({ pu: pickup, onDrag: onPickupDragEnd });
  pickupLatest.current = { pu: pickup, onDrag: onPickupDragEnd };

  const renderMarkers = useCallback((marks: MapMarker[]) => {
    const map = mapRef.current;
    const gl = glRef.current;
    if (!map || !gl) return;
    markerInstancesRef.current.forEach((m) => m.remove());
    markerInstancesRef.current = [];
    for (const mk of marks) {
      const el = document.createElement("div");
      const isSm = mk.size === "sm";
      el.style.width = isSm ? "10px" : "16px";
      el.style.height = isSm ? "10px" : "16px";
      el.style.borderRadius = "50%";
      el.style.backgroundColor = mk.color ?? "#087C55";
      el.style.border = "2px solid #ffffff";
      el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
      el.style.cursor = "pointer";
      if (mk.label) el.title = mk.label;
      const marker = new gl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([mk.lng, mk.lat])
        .addTo(map);
      markerInstancesRef.current.push(marker);
    }
  }, []);

  const renderPickup = useCallback(
    (pu: { lat: number; lng: number } | null | undefined, onDrag?: (lat: number, lng: number) => void) => {
      const map = mapRef.current;
      const gl = glRef.current;
      if (!map || !gl || !pu) return;
      pickupInstanceRef.current?.remove();
      const el = document.createElement("div");
      el.style.width = "20px";
      el.style.height = "20px";
      el.style.borderRadius = "50% 50% 50% 0";
      el.style.backgroundColor = "#F28C28";
      el.style.border = "2px solid #ffffff";
      el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.35)";
      el.style.transform = "rotate(45deg)";
      el.style.cursor = "pointer";
      const marker = new gl.Marker({ element: el, anchor: "center", draggable: true })
        .setLngLat([pu.lng, pu.lat])
        .addTo(map);
      marker.on("dragend", () => {
        const ll = marker.getLngLat();
        onDrag?.(ll.lat, ll.lng);
      });
      pickupInstanceRef.current = marker;
    },
    [],
  );

  useEffect(() => {
    let map: any;

    const load = async () => {
      const mod = await import("maplibre-gl");
      const gl = mod as any;
      glRef.current = gl;
      if (typeof gl.setWorkerUrl === "function") {
        gl.setWorkerUrl("/maplibre-gl-worker.mjs");
      }

      map = new gl.Map({
        container: containerRef.current!,
        center: center as [number, number],
        zoom,
        style: { version: 8, sources: {}, layers: [] },
        attributionControl: true,
      });

      map.on("load", () => {
        if (!map.getSource("osm")) {
          map.addSource("osm", {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "\u00A9 OpenStreetMap contributors",
          });
          map.addLayer({
            id: "osm-layer",
            type: "raster",
            source: "osm",
          });
        }
        renderMarkers(markersLatest.current);
        renderPickup(pickupLatest.current.pu, pickupLatest.current.onDrag);
        onLoadRef.current?.();
      });

      mapRef.current = map;
    };

    load();

    return () => {
      map?.remove();
      markerInstancesRef.current.forEach((m) => m.remove());
      markerInstancesRef.current = [];
      pickupInstanceRef.current?.remove();
      pickupInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderMarkers(markers);
  }, [markers, renderMarkers]);

  useEffect(() => {
    renderPickup(pickup, onPickupDragEnd);
  }, [pickup, onPickupDragEnd, renderPickup]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setCenter(center as [number, number]);
    map.setZoom(zoom);
  }, [center, zoom]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
}