import { NextRequest, NextResponse } from "next/server";
import { respondRental } from "@/lib/mock-store";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const ok = respondRental(id, !!body.confirm);
  return NextResponse.json({ ok });
}