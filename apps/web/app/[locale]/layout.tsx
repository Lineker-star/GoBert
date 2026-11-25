import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import "../globals.css";

const heading = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

const locales = ["fr", "en"];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const metadata = {
  metadataBase: new URL("https://gobert.cm"),
  title: {
    template: "%s | GoBert",
    default: "GoBert — Mobilité à Bertoua",
  },
  description:
    "Motos, taxis, tricycles, camions, location de véhicules et livraison express à Bertoua et dans toutes les régions du Cameroun.",
  keywords: ["GoBert", "Bertoua", "moto", "taxi", "transport", "Cameroun", "livraison", "location"],
  authors: [{ name: "GoBert Team", url: "https://gobert.cm" }],
  creator: "GoBert Team",
  publisher: "GoBert",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "fr_CM",
    siteName: "GoBert",
    title: "GoBert — Mobilité à Bertoua",
    description:
      "Motos, taxis, tricycles, camions, location de véhicules et livraison express à Bertoua.",
    images: [
      {
        url: "/icon-512.svg",
        width: 512,
        height: 512,
        alt: "GoBert logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GoBert — Mobilité à Bertoua",
    description:
      "Motos, taxis, tricycles, camions, location de véhicules et livraison express.",
    images: ["/icon-512.svg"],
  },
  icons: {
    icon: "/icon-192.svg",
    shortcut: "/icon-192.svg",
    apple: "/icon-192.svg",
  },
  manifest: "/manifest.json",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale)) notFound();
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      className={`${heading.variable} ${body.variable}`}
    >
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        <meta name="theme-color" content="#087C55" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="GoBert" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="GoBert" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
        <link rel="icon" href="/icon-192.svg" sizes="any" />
        <link rel="mask-icon" href="/icon-maskable.svg" color="#087C55" />
        <link rel="shortcut icon" href="/icon-192.svg" />
      </head>
      <body className="bg-[var(--color-ivory)] text-[var(--color-charcoal)]">
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegistrar />
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
