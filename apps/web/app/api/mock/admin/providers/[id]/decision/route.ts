import { NextRequest, NextResponse } from "next/server";
import { decideProvider } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { decision, reason } = body;
  if (!decision) return NextResponse.json({ error: "missing decision" }, { status: 400 });
  const ok = decideProvider(id, decision, reason ?? null);
  return NextResponse.json({ ok });
}