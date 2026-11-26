import { NextRequest } from "next/server";
import { submitDraft, getDraft, validateRegistration } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const b = await body<{ draft_id?: string }>(req);
  if (!b.draft_id) return bad("missing draft_id");
  const draft = getDraft(b.draft_id);
  if (!draft) return bad("draft not found", 404);
  const v = validateRegistration(draft.data);
  if (!v.ok) return json({ error: "incomplete", missing: v.missing }, 422);
  const provider = submitDraft(b.draft_id);
  if (!provider) return bad("draft not found", 404);
  return json(provider);
}
