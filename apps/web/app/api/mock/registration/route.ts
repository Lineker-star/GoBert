import { NextRequest, NextResponse } from "next/server";
import { saveDraft, getDraft, type RegistrationData } from "@/lib/mock-store";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { draft_id, user_id, step, data } = body as {
    draft_id?: string | null;
    user_id: string;
    step: number;
    data: RegistrationData;
  };
  const draft = saveDraft(draft_id ?? null, user_id ?? "anon", step ?? 0, data ?? {});
  return NextResponse.json(draft);
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const draft = getDraft(id);
  if (!draft) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(draft);
}