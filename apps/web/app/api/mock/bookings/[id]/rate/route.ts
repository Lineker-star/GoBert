import { NextRequest, NextResponse } from "next/server";
import { rateBooking } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const ok = rateBooking(id, body.stars, body.comment ?? "");
  return NextResponse.json({ ok });
}