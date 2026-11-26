import { NextRequest } from "next/server";
import { getParcelsForProvider, getParcelsForSender, createParcel, type ParcelSize } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

const SIZES: ParcelSize[] = ["small", "medium", "large"];
type Point = { lat: number; lng: number; label: string };

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  const sender = req.nextUrl.searchParams.get("sender");
  if (provider) {
    // Couriers never see the delivery code — they get it from the receiver.
    return json(getParcelsForProvider(provider).map((p) => ({ ...p, otp: null })));
  }
  if (sender) return json(getParcelsForSender(sender));
  return bad("missing provider or sender");
}

export async function POST(req: NextRequest) {
  const b = await body<{
    sender_user_id?: string | null;
    sender_name?: string;
    sender_phone?: string;
    receiver_name?: string;
    receiver_phone?: string;
    pickup?: Point;
    dropoff?: Point;
    size?: ParcelSize;
    notes?: string;
    photo?: string | null;
  }>(req);
  for (const k of ["sender_name", "sender_phone", "receiver_name", "receiver_phone"] as const) {
    if (!String(b[k] ?? "").trim()) return bad(`missing ${k}`);
  }
  if (!b.pickup?.label || !b.dropoff?.label) return bad("missing pickup/dropoff");
  return json(
    createParcel({
      sender_user_id: b.sender_user_id ?? null,
      sender_name: b.sender_name!,
      sender_phone: b.sender_phone!,
      receiver_name: b.receiver_name!,
      receiver_phone: b.receiver_phone!,
      pickup: b.pickup,
      dropoff: b.dropoff,
      size: b.size && SIZES.includes(b.size) ? b.size : "small",
      notes: b.notes?.slice(0, 300) ?? null,
      photo: b.photo ?? null,
    }),
  );
}
