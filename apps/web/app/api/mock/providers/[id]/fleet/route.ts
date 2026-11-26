import { NextRequest } from "next/server";
import {
  getProvider,
  getFleetForProvider,
  addRentalVehicle,
  updateRentalVehicle,
  removeRentalVehicle,
  type FleetInput,
} from "@/lib/mock-store";
import { json, bad, body, type RouteCtx } from "@/lib/api-helpers";

function owned(id: string, user: string | null | undefined) {
  const p = getProvider(id);
  return p && user && p.owner_user_id === user ? p : null;
}

export async function GET(_req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  return json(getFleetForProvider(id));
}

export async function POST(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<FleetInput & { user?: string }>(req);
  if (!owned(id, b.user)) return bad("forbidden", 403);
  if (!b.brand?.trim() || !b.model?.trim() || !b.plate?.trim()) return bad("missing vehicle fields");
  if (!(Number(b.price_per_day_xaf) > 0)) return bad("price_per_day_xaf must be > 0");
  const v = addRentalVehicle(id, b);
  return v ? json(v) : bad("not a business");
}

export async function PATCH(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const b = await body<{
    user?: string;
    vehicle_id?: string;
    available?: boolean;
    price_per_day_xaf?: number;
    price_per_hour_xaf?: number;
    with_driver?: boolean;
  }>(req);
  if (!owned(id, b.user) || !b.vehicle_id) return bad("forbidden", 403);
  const patch: Parameters<typeof updateRentalVehicle>[2] = {};
  if (typeof b.available === "boolean") patch.available = b.available;
  if (typeof b.with_driver === "boolean") patch.with_driver = b.with_driver;
  if (Number(b.price_per_day_xaf) > 0) patch.price_per_day_xaf = Math.round(Number(b.price_per_day_xaf));
  if (Number(b.price_per_hour_xaf) > 0) patch.price_per_hour_xaf = Math.round(Number(b.price_per_hour_xaf));
  const v = updateRentalVehicle(b.vehicle_id, id, patch);
  return v ? json(v) : bad("not found", 404);
}

export async function DELETE(req: NextRequest, { params }: RouteCtx) {
  const { id } = await params;
  const user = req.nextUrl.searchParams.get("user");
  const vehicleId = req.nextUrl.searchParams.get("vehicle");
  if (!owned(id, user) || !vehicleId) return bad("forbidden", 403);
  return json({ ok: removeRentalVehicle(vehicleId, id) });
}
