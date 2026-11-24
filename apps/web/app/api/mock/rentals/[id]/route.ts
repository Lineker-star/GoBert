import { NextRequest, NextResponse } from "next/server";
import { getRentalRequest } from "@/lib/mock-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = getRentalRequest(id);
  if (!request) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(request);
}