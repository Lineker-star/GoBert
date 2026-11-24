import { NextRequest, NextResponse } from "next/server";
import { getParcel } from "@/lib/mock-store";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parcel = getParcel(id);
  if (!parcel) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(parcel);
}