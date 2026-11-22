import { useTranslations } from "next-intl";

export default function ProvidersAdminPage() {
  const t = useTranslations("admin");
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-[#087C55] mb-4">{t("verificationQueue")}</h1>
      <p>{t("noPending")}</p>
    </main>
  );
}
