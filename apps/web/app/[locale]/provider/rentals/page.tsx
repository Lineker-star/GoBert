import { redirect } from "next/navigation";

/** Legacy route kept so old links and PWA shortcuts still work. */
export default async function LegacyRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
