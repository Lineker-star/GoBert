import { NextRequest, NextResponse } from "next/server";
import { setBookingStatus, type BookingStatus } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status } = body;
  if (!status) return NextResponse.json({ error: "missing status" }, { status: 400 });
  const ok = setBookingStatus(id, status as BookingStatus);
  return NextResponse.json({ ok });
}