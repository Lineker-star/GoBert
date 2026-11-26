import { NextRequest } from "next/server";
import { saveDraft, getDraft, getDraftByUser, type RegistrationData } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const b = await body<{ draft_id?: string | null; user_id?: string; step?: number; data?: RegistrationData }>(req);
  if (!b.user_id) return bad("missing user_id");
  return json(saveDraft(b.draft_id ?? null, b.user_id, b.step ?? 0, b.data ?? {}));
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const user = req.nextUrl.searchParams.get("user");
  const draft = id ? getDraft(id) : user ? getDraftByUser(user) : undefined;
  if (!draft) return bad("not found", 404);
  return json(draft);
}
