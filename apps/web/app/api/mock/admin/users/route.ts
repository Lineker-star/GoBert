import { NextRequest } from "next/server";
import { listUsers, getProvider, type UserRole } from "@/lib/mock-store";
import { json } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const role = (req.nextUrl.searchParams.get("role") || undefined) as UserRole | undefined;
  return json(
    listUsers(role)
      .slice()
      .reverse()
      .map((u) => {
        const p = u.provider_id ? getProvider(u.provider_id) : undefined;
        return { ...u, verification_status: p?.verification_status ?? null, provider_name: p?.display_name ?? null };
      }),
  );
}
