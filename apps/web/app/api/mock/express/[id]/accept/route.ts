import { NextRequest } from "next/server";
import { acceptParcel } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ provider_id?: string }>(req);
  if (!b.provider_id) return bad("missing provider_id");
  return json({ ok: acceptParcel(id, b.provider_id) });
}
