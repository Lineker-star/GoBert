import { NextRequest } from "next/server";
import { setBookingStatus, type BookingStatus } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

const ALLOWED: BookingStatus[] = ["arriving", "in_progress", "completed", "cancelled"];

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ status?: BookingStatus }>(req);
  if (!b.status || !ALLOWED.includes(b.status)) return bad("invalid status");
  return json({ ok: setBookingStatus(id, b.status) });
}
