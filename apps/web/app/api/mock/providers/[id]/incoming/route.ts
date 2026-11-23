import { NextRequest, NextResponse } from "next/server";
import { getIncomingForProvider } from "@/lib/mock-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json(getIncomingForProvider(id));
}