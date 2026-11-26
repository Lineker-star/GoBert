import { NextRequest } from "next/server";
import { getUser, getProvider, getDraftByUser, getFleetForProvider } from "@/lib/mock-store";
import { json, bad, type RouteCtx } from "@/lib/api-helpers";

/** Owner view: the user's profile plus their provider record, onboarding draft and fleet. */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const user = getUser(id);
  if (!user) return bad("not found", 404);
  const provider = user.provider_id ? getProvider(user.provider_id) ?? null : null;
  const draft = getDraftByUser(id) ?? null;
  const fleet = provider?.kind === "business" ? getFleetForProvider(provider.id) : [];
  return json({ user, provider, draft, fleet });
}
