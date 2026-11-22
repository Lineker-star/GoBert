import { useTranslations } from "next-intl";

export default function DesignPage() {
  const t = useTranslations("home");
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-green mb-4">Design System</h1>
      <button className="bg-green text-white rounded-lg px-4 py-2">Primary</button>
      <button className="bg-orange text-white rounded-lg px-4 py-2 ml-2">Accent</button>
    </main>
  );
}
