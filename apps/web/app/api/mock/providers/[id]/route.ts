import { NextRequest } from "next/server";
import { getProvider, toPublicProvider, updateProviderSettings } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const p = getProvider(id);
  if (!p) return bad("not found", 404);
  const owner = req.nextUrl.searchParams.get("user");
  if (owner && p.owner_user_id === owner) return json(p); // owners see their full record
  if (p.verification_status !== "approved") return bad("not found", 404);
  return json(toPublicProvider(p));
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{
    user?: string;
    accepts_direct_calls?: boolean;
    whatsapp?: string | null;
    bio?: string;
  }>(req);
  const p = getProvider(id);
  if (!p) return bad("not found", 404);
  if (!b.user || p.owner_user_id !== b.user) return bad("forbidden", 403);
  return json(
    updateProviderSettings(id, {
      accepts_direct_calls: b.accepts_direct_calls,
      whatsapp: b.whatsapp,
      bio: b.bio,
    }),
  );
}
