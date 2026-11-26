import { NextRequest } from "next/server";
import { getRentals, createRentalRequest } from "@/lib/mock-store";
import { json, bad, body } from "@/lib/api-helpers";

/** Public catalogue — only available vehicles of approved businesses. */
export async function GET() {
  return json(getRentals());
}

export async function POST(req: NextRequest) {
  const b = await body<{
    vehicle_id?: string;
    customer_user_id?: string | null;
    customer_name?: string;
    phone?: string;
    start_date?: string;
    end_date?: string;
    with_driver?: boolean;
  }>(req);
  if (!b.vehicle_id || !b.start_date || !b.end_date) return bad("missing fields");
  if (!String(b.phone ?? "").trim()) return bad("missing phone");
  const request = createRentalRequest({
    vehicle_id: b.vehicle_id,
    customer_user_id: b.customer_user_id ?? null,
    customer_name: String(b.customer_name ?? "").trim() || "Client",
    phone: String(b.phone),
    start_date: b.start_date,
    end_date: b.end_date,
    with_driver: !!b.with_driver,
  });
  if (!request) return bad("vehicle unavailable or invalid dates", 409);
  return json(request);
}
