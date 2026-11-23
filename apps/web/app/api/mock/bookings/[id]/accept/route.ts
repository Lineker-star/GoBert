import { NextRequest, NextResponse } from "next/server";
import { acceptBooking, declineBooking } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const providerId = body.provider_id;
  if (!providerId) return NextResponse.json({ error: "missing provider_id" }, { status: 400 });
  const won = acceptBooking(id, providerId);
  if (body.decline) declineBooking(id, providerId);
  return NextResponse.json({ won });
}