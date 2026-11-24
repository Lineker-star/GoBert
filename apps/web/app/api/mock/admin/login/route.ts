import { NextRequest, NextResponse } from "next/server";
import { adminLogin } from "@/lib/mock-store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const ok = adminLogin(body.email ?? "", body.password ?? "");
  if (!ok) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  return NextResponse.json({ ok: true, role: "admin" });
}