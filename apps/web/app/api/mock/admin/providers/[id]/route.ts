import { NextRequest } from "next/server";
import { getProviderDetail, adminUpdateProvider, type RegistrationData } from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const detail = getProviderDetail(id);
  if (!detail) return bad("not found", 404);
  return json(detail);
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{ data?: RegistrationData }>(req);
  const p = adminUpdateProvider(id, b.data ?? {});
  return p ? json(p) : bad("not found", 404);
}
