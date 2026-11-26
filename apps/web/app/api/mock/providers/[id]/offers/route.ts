import { NextRequest } from "next/server";
import { getProvider, toPublicProvider, getFleetForProvider, listBookingsForProvider } from "@/lib/mock-store";
import { json, bad, type RouteCtx } from "@/lib/api-helpers";

/** Demo equivalent of the provider_offers() RPC (which requires a registered account). */
export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const p = getProvider(id);
  if (!p || p.verification_status !== "approved") return bad("not found", 404);
  return json({
    provider: toPublicProvider(p),
    fleet: getFleetForProvider(id).filter((v) => v.available),
    reviews: listBookingsForProvider(id)
      .filter((b) => b.rating)
      .slice(0, 20)
      .map((b) => ({ stars: b.rating, comment: b.rating_comment, at: b.completed_at })),
  });
}
