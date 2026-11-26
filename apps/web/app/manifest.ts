import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GoBert — Move. Connect. Go.",
    short_name: "GoBert",
    description:
      "Motos, taxis, tricycles, camions, location de véhicules et livraison express à Bertoua et dans l'Est du Cameroun.",
    id: "/fr",
    start_url: "/fr/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F7F5EF",
    theme_color: "#087C55",
    categories: ["travel", "transportation", "lifestyle"],
    lang: "fr",
    dir: "ltr",
    scope: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Réserver une course",
        short_name: "Réserver",
        description: "Commander une moto, un taxi ou un camion",
        url: "/fr/map",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Envoyer un colis",
        short_name: "Colis",
        url: "/fr/express",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "Devenir partenaire",
        short_name: "Partenaire",
        description: "S'inscrire comme rider ou prestataire",
        url: "/fr/auth?role=rider",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
    prefer_related_applications: false,
  };
}
