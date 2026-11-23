import { NextRequest, NextResponse } from "next/server";
import { estimateFare, type VehicleType } from "@/lib/mock-store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { pickup, dropoff, vehicle_type } = body;
  if (!pickup || !dropoff || !vehicle_type) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const est = estimateFare(pickup, dropoff, vehicle_type as VehicleType);
  return NextResponse.json(est);
}