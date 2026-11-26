import { NextRequest } from "next/server";
import { adminCreateProvider, type ProviderKind, type RegistrationData } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  const b = await body<{ kind?: ProviderKind; data?: RegistrationData; approve?: boolean }>(req);
  if (b.kind !== "rider" && b.kind !== "business") return bad("invalid kind");
  if (!b.data?.phone) return bad("phone required");
  const p = adminCreateProvider(b.kind, b.data, !!b.approve);
  return p ? json(p) : bad("could not create");
}
