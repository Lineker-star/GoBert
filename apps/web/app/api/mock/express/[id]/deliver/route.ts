import { NextRequest, NextResponse } from "next/server";
import { deliverParcel } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const ok = deliverParcel(id, String(body.otp ?? ""));
  return NextResponse.json({ ok });
}