import { NextRequest, NextResponse } from "next/server";
import { getRentals, createRentalRequest } from "@/lib/mock-store";

export async function GET() {
  return NextResponse.json(getRentals());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const request = createRentalRequest({
    vehicle_id: body.vehicle_id,
    customer_name: body.customer_name ?? "Client",
    phone: body.phone ?? "",
    start_date: body.start_date,
    end_date: body.end_date,
    with_driver: !!body.with_driver,
  });
  return NextResponse.json(request);
}