import { NextRequest } from "next/server";
import { getAISettings, updateAISettings, type AISettings } from "@/lib/mock-store";
import { json, body } from "@/lib/api-helpers";

export async function GET() {
  return json(getAISettings());
}

export async function PUT(req: NextRequest) {
  const b = await body<Partial<AISettings>>(req);
  // Only apply fields that were actually sent (previously, missing fields were overwritten with undefined).
  const patch: Partial<AISettings> = {};
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  if (typeof b.model === "string" && b.model.trim()) patch.model = b.model.trim();
  if (typeof b.system_prompt === "string") patch.system_prompt = b.system_prompt;
  if (Number.isFinite(b.rate_limit)) patch.rate_limit = Math.max(1, Math.round(b.rate_limit as number));
  return json(updateAISettings(patch));
}
