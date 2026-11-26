import { NextRequest } from "next/server";
import { acceptBooking, declineBooking } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ provider_id?: string; decline?: boolean }>(req);
  if (!b.provider_id) return bad("missing provider_id");
  if (b.decline) {
    declineBooking(id, b.provider_id);
    return json({ won: false });
  }
  return json({ won: acceptBooking(id, b.provider_id) });
}
