import { NextRequest } from "next/server";
import { rateBooking } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ stars?: number; comment?: string }>(req);
  const stars = Number(b.stars);
  if (!Number.isFinite(stars) || stars < 1 || stars > 5) return bad("stars must be 1-5");
  return json({ ok: rateBooking(id, stars, String(b.comment ?? "").slice(0, 500)) });
}
