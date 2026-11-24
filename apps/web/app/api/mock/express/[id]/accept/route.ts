import { NextRequest, NextResponse } from "next/server";
import { acceptParcel } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const ok = acceptParcel(id, body.provider_id ?? "00000000-0000-0000-0000-000000000001");
  return NextResponse.json({ ok });
}