import { NextRequest, NextResponse } from "next/server";
import { getProviderDetail } from "@/lib/mock-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = getProviderDetail(id);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}