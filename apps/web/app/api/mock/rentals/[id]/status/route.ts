import { NextRequest } from "next/server";
import { setRentalStatus, cancelRentalRequest } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ status?: "active" | "completed" | "cancelled"; provider_id?: string; user_id?: string }>(req);
  if (b.status === "cancelled") {
    if (!b.user_id) return bad("missing user_id");
    return json({ ok: cancelRentalRequest(id, b.user_id) });
  }
  if (!b.provider_id || (b.status !== "active" && b.status !== "completed")) return bad("invalid request");
  return json({ ok: setRentalStatus(id, b.provider_id, b.status) });
}
