import { NextRequest } from "next/server";
import { getParcel } from "@/lib/mock-store";
import { json, bad, type RouteCtx } from "@/lib/api-helpers";

export async function GET(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const parcel = getParcel(id);
  if (!parcel) return bad("not found", 404);
  // The delivery code is only shown to the sender.
  const viewer = req.nextUrl.searchParams.get("user");
  const isSender = !parcel.sender_user_id || viewer === parcel.sender_user_id;
  return json(isSender ? parcel : { ...parcel, otp: null });
}
