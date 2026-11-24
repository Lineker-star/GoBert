import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoBert",
    short_name: "GoBert",
    description: "Mobilité à Bertoua — motos, taxis, livraison et location",
    start_url: "/fr",
    display: "standalone",
    background_color: "#F7F5EF",
    theme_color: "#087C55",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}