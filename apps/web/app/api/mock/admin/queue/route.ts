import { NextRequest, NextResponse } from "next/server";
import { getQueue, type ProviderStatus } from "@/lib/mock-store";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status") as ProviderStatus | null;
  const list = getQueue(status ?? undefined);
  return NextResponse.json(list);
}