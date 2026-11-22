import { useTranslations } from "next-intl";

export default function Home() {
  const t = useTranslations("home");
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-4xl font-bold text-[#087C55]">{t("title")}</h1>
      <p className="text-lg">{t("tagline")}</p>
    </main>
  );
}
