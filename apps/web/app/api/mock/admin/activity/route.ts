import { listAllBookings, listAllRentalRequests, listAllParcels, getProvider } from "@/lib/mock-store";
import { json } from "@/lib/api-helpers";

export async function GET() {
  const name = (id: string | null) => (id ? getProvider(id)?.display_name ?? null : null);
  return json({
    bookings: listAllBookings()
      .slice(0, 200)
      .map((b) => ({ ...b, provider_name: name(b.provider_id) })),
    rentals: listAllRentalRequests()
      .slice(0, 200)
      .map((r) => ({ ...r, provider_name: name(r.provider_id) })),
    parcels: listAllParcels()
      .slice(0, 200)
      .map(({ otp: _otp, photo: _photo, ...p }) => ({ ...p, provider_name: name(p.provider_id) })),
  });
}
