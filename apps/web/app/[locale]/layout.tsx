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
    <html lang={locale} className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <body className="bg-[var(--ivory)] text-[var(--charcoal)]">
        <NextIntlClientProvider messages={messages}>
          <ServiceWorkerRegistrar />
          <AuthProvider>{children}</AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
