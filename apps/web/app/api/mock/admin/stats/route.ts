import { NextRequest, NextResponse } from "next/server";
import { getStats } from "@/lib/mock-store";

export async function GET(req: NextRequest) {
  return NextResponse.json(getStats(Number(req.nextUrl.searchParams.get("days") ?? 14)));
}
