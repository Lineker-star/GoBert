import { NextRequest, NextResponse } from "next/server";
import { submitDraft } from "@/lib/mock-store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { draft_id } = body;
  if (!draft_id) return NextResponse.json({ error: "missing draft_id" }, { status: 400 });
  const provider = submitDraft(draft_id);
  if (!provider) return NextResponse.json({ error: "draft not found" }, { status: 404 });
  return NextResponse.json(provider);
}