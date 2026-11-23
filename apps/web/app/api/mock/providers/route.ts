import { NextRequest, NextResponse } from "next/server";
import { getProviders, setProviderOnline } from "@/lib/mock-store";

export async function GET() {
  return NextResponse.json(getProviders());
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, is_online, lat, lng } = body;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  setProviderOnline(id, !!is_online, lat != null && lng != null ? { lat, lng } : undefined);
  return NextResponse.json({ ok: true });
}