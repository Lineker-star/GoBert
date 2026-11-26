import { redirect } from "next/navigation";

/** The planner now lives on the home screen; keep old links (and their ?vehicle= query) working. */
export default async function MapRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") q.set(k, v);
  redirect(`/${locale}${q.size ? `?${q.toString()}` : ""}`);
}
