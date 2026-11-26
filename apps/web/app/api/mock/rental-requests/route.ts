import { NextRequest } from "next/server";
import { getRentalRequestsForProvider, getRentalRequestsForCustomer } from "@/lib/mock-store";
import { json, bad } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider");
  const customer = req.nextUrl.searchParams.get("customer");
  if (provider) return json(getRentalRequestsForProvider(provider));
  if (customer) return json(getRentalRequestsForCustomer(customer));
  return bad("missing provider or customer");
}
