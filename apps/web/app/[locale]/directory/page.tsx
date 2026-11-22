"use client";
import { useTranslations } from "next-intl";

export default function DirectoryPage() {
  const t = useTranslations("directory");
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-[#087C55] mb-4">{t("title")}</h1>
      <p>{t("empty")}</p>
    </main>
  );
}
