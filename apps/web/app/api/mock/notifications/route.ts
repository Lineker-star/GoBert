import { NextRequest } from "next/server";
import { getNotifications, markNotificationsRead } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const user = req.nextUrl.searchParams.get("user");
  if (!user) return bad("missing user");
  return json(getNotifications(user));
}

export async function POST(req: NextRequest) {
  const b = await body<{ user?: string }>(req);
  if (!b.user) return bad("missing user");
  markNotificationsRead(b.user);
  return json({ ok: true });
}
