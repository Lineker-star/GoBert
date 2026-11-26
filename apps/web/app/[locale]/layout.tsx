import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import OfflineBanner from "@/components/home/OfflineBanner";
import "../globals.css";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading", weight: ["500", "600", "700", "800"], display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });

const locales = ["fr", "en"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#087C55",
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const fr = locale !== "en";
  const title = fr ? "GoBert — Mobilité à Bertoua" : "GoBert — Mobility in Bertoua";
  const description = fr
    ? "Motos, taxis, tricycles, camions, location de véhicules et livraison express à Bertoua et dans l'Est du Cameroun. Prestataires vérifiés."
    : "Motorbikes, taxis, tricycles, trucks, vehicle rental and express delivery in Bertoua and East Cameroon. Verified providers.";
  return {
    metadataBase: new URL("https://gobert.cm"),
    title: { template: "%s | GoBert", default: title },
    description,
    keywords: ["GoBert", "Bertoua", "moto", "taxi", "transport", "Cameroun", "livraison", "location"],
    applicationName: "GoBert",
    alternates: { languages: { fr: "/fr", en: "/en" } },
    openGraph: {
      type: "website",
      locale: fr ? "fr_CM" : "en_CM",
      siteName: "GoBert",
      title,
      description,
      images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "GoBert — Move. Connect. Go." }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/og-image.jpg"] },
    icons: {
      icon: [
        { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "GoBert", statusBarStyle: "default" },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="bg-ivory text-charcoal antialiased">
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegistrar />
          <AuthProvider>
            <OfflineBanner />
            {children}
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
