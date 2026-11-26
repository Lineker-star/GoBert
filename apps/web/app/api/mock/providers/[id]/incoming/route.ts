import { NextRequest } from "next/server";
import { getIncomingForProvider, maskPhone } from "@/lib/mock-store";
import { json, type RouteCtx } from "@/lib/api-helpers";

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  // The passenger's phone stays masked until the rider wins the trip.
  return json(getIncomingForProvider(id).map((b) => ({ ...b, passenger_phone: maskPhone(b.passenger_phone) })));
}
