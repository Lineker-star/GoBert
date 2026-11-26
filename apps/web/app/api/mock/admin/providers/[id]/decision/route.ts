import { NextRequest } from "next/server";
import { decideProvider, type Decision } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

const DECISIONS: Decision[] = ["approve", "reject", "request_changes", "suspend"];

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ decision?: Decision; reason?: string }>(req);
  if (!b.decision || !DECISIONS.includes(b.decision)) return bad("invalid decision");
  const reason = b.reason?.trim() || null;
  if (b.decision !== "approve" && !reason) return bad("a reason is required");
  const ok = decideProvider(id, b.decision, reason);
  return ok ? json({ ok }) : bad("not found", 404);
}
