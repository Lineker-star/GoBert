import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoBert — Mobilité à Bertoua",
    short_name: "GoBert",
    description:
      "Motos, taxis, tricycles, camions, location de véhicules et livraison express à Bertoua et dans toutes les régions du Cameroun.",
    start_url: "/fr",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#F7F5EF",
    theme_color: "#087C55",
    categories: ["travel", "transportation", "lifestyle"],
    lang: "fr",
    dir: "ltr",
    scope: "/",
    screenshots: [
      {
        src: "/screenshot-mobile.png",
        sizes: "390x844",
        type: "image/png",
        form_factor: "narrow",
        label: "GoBert landing page mobile",
      },
      {
        src: "/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "GoBert map and booking desktop",
      },
    ],
    icons: [
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "monochrome",
      },
    ],
    shortcuts: [
      {
        name: "Réserver une course",
        short_name: "Réserver",
        description: "Commander une moto, un taxi ou un camion",
        url: "/fr/map",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
      {
        name: "S'inscrire",
        short_name: "S'inscrire",
        description: "Créer un compte utilisateur ou prestataire",
        url: "/fr/auth",
        icons: [{ src: "/icon-192.svg", sizes: "192x192" }],
      },
    ],
    related_applications: [],
    prefer_related_applications: false,
  };
}
