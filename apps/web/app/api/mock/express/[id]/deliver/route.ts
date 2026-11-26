import { NextRequest } from "next/server";
import { deliverParcel } from "@/lib/mock-store";
import { json, body, type RouteCtx } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ otp?: string; provider_id?: string }>(req);
  return json({ ok: deliverParcel(id, String(b.otp ?? ""), b.provider_id) });
}
