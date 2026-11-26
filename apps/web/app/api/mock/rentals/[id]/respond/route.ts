import { NextRequest } from "next/server";
import { respondRental } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ confirm?: boolean; provider_id?: string }>(req);
  if (!b.provider_id) return bad("missing provider_id");
  return json({ ok: respondRental(id, !!b.confirm, b.provider_id) });
}
