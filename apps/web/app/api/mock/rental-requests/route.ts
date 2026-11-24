import { NextRequest, NextResponse } from "next/server";
import { getRentalRequestsForProvider, getRentalRequest } from "@/lib/mock-store";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  if (!provider) {
    // list all (for passenger status polling we use /[id]; this returns provider-scoped)
    return NextResponse.json([]);
  }
  return NextResponse.json(getRentalRequestsForProvider(provider));
}