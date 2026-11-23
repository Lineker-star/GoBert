import { NextRequest, NextResponse } from "next/server";
import { createBooking, getBooking } from "@/lib/mock-store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { passenger_id, vehicle_type, pickup, dropoff } = body;
  if (!pickup || !dropoff || !vehicle_type) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const booking = createBooking({ passenger_id: passenger_id ?? "anon", vehicle_type, pickup, dropoff });
  return NextResponse.json(booking);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const booking = getBooking(id);
  if (!booking) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(booking);
}