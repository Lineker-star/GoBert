import { NextRequest } from "next/server";
import { getQueue, type ProviderStatus, type ProviderKind } from "@/lib/mock-store";
import { json } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const status = (req.nextUrl.searchParams.get("status") || undefined) as ProviderStatus | undefined;
  const kind = (req.nextUrl.searchParams.get("kind") || undefined) as ProviderKind | undefined;
  return json(getQueue(status, kind));
}
