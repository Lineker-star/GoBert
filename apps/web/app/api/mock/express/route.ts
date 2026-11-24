import { NextRequest, NextResponse } from "next/server";
import { getParcelsForProvider, createParcel, type ParcelSize } from "@/lib/mock-store";

export async function GET() {
  return NextResponse.json(getParcelsForProvider());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parcel = createParcel({
    sender_name: body.sender_name ?? "Expéditeur",
    sender_phone: body.sender_phone ?? "",
    receiver_name: body.receiver_name ?? "Destinataire",
    receiver_phone: body.receiver_phone ?? "",
    pickup: body.pickup ?? { lat: 4.5774, lng: 13.6846, label: "Bertoua" },
    dropoff: body.dropoff ?? { lat: 4.58, lng: 13.69, label: "Mokolo" },
    size: (body.size ?? "small") as ParcelSize,
    photo: body.photo ?? null,
  });
  return NextResponse.json(parcel);
}