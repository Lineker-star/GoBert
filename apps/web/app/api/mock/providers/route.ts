import { NextRequest } from "next/server";
import { getPublicProviders, setProviderOnline, type ServiceKey, type ProviderKind } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

/** Public directory: approved providers only (pending/rejected/suspended are never listed). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  return json(
    getPublicProviders({
      onlineOnly: sp.get("online") === "1",
      service: (sp.get("service") as ServiceKey) || undefined,
      kind: (sp.get("kind") as ProviderKind) || undefined,
    }),
  );
}

export async function PATCH(req: NextRequest) {
  const b = await body<{ id?: string; is_online?: boolean; lat?: number; lng?: number }>(req);
  if (!b.id) return bad("missing id");
  const loc = b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : undefined;
  if (!setProviderOnline(b.id, !!b.is_online, loc)) return bad("provider not approved", 403);
  return json({ ok: true });
}
