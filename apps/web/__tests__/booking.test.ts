import { describe, it, expect, beforeEach } from "vitest";
import {
  __resetStore,
  createBooking,
  acceptBooking,
  declineBooking,
  setBookingStatus,
  rateBooking,
  getBooking,
  getIncomingForProvider,
  estimateFare,
  saveDraft,
  submitDraft,
  getProviders,
  getProvider,
  decideProvider,
  getPublicProviders,
  setProviderOnline,
  getRentals,
  createRentalRequest,
  respondRental,
  upsertUser,
  getUser,
  validateRegistration,
  createParcel,
  acceptParcel,
  pickupParcel,
  deliverParcel,
  getParcelsForProvider,
  type RegistrationData,
} from "@/lib/mock-store";

const PICKUP = { lat: 4.5774, lng: 13.6846, label: "Bertoua Centre" };
const DROPOFF = { lat: 4.58, lng: 13.69, label: "Marché Central" };
const DOC = (type: string) => ({ type, name: `${type}.jpg`, size: 10, data_url: "data:image/jpeg;base64,AA" });

const RIDER_DATA: RegistrationData = {
  kind: "rider",
  full_name: "Jean Mbarga",
  phone: "+237699112233",
  vehicle_type: "moto",
  brand: "Sanya",
  model: "SY 125",
  plate: "ES 123 AB",
  documents: [DOC("id_card"), DOC("license"), DOC("registration")],
  services: [{ type: "moto", title_fr: "moto", title_en: "moto", base_price_xaf: 300, zones: ["Bertoua"] }],
};

function newMotoBooking() {
  return createBooking({ passenger_id: "passenger-1", vehicle_type: "moto", pickup: PICKUP, dropoff: DROPOFF });
}

beforeEach(() => __resetStore());

describe("bookings", () => {
  it("creates a booking with an estimated fare and cash by default", () => {
    const b = newMotoBooking();
    expect(b.status).toBe("requested");
    expect(b.fare_estimate_xaf).toBeGreaterThan(0);
    expect(b.fare_estimate_xaf % 25).toBe(0);
    expect(b.payment_method).toBe("cash");
    expect(getBooking(b.id)?.id).toBe(b.id);
  });

  it("keeps the chosen mobile-money payment method", () => {
    const b = createBooking({ passenger_id: "p", vehicle_type: "taxi", pickup: PICKUP, dropoff: DROPOFF, payment_method: "mtn_momo" });
    expect(b.payment_method).toBe("mtn_momo");
  });

  it("estimates a fare that grows with distance", () => {
    const near = estimateFare(PICKUP, DROPOFF, "taxi");
    const far = estimateFare(PICKUP, { lat: 4.65, lng: 13.75 }, "taxi");
    expect(far.fare_estimate_xaf).toBeGreaterThan(near.fare_estimate_xaf);
    expect(near.eta_min).toBeGreaterThan(0);
  });

  it("has a single winner when two riders accept", () => {
    const b = newMotoBooking();
    const [p1, p2] = getProviders();
    expect(acceptBooking(b.id, p1.id)).toBe(true);
    expect(acceptBooking(b.id, p2.id)).toBe(false);
    expect(getBooking(b.id)?.provider_id).toBe(p1.id);
  });

  it("refuses acceptance from a provider who is not approved", () => {
    const b = newMotoBooking();
    const pending = getProviders().find((p) => p.verification_status === "pending")!;
    pending.is_online = true; // even if somehow online
    expect(acceptBooking(b.id, pending.id)).toBe(false);
  });

  it("hides a request from a rider after they decline it", () => {
    const b = newMotoBooking();
    const rider = getProviders()[0];
    expect(getIncomingForProvider(rider.id).some((x) => x.id === b.id)).toBe(true);
    declineBooking(b.id, rider.id);
    expect(getIncomingForProvider(rider.id).some((x) => x.id === b.id)).toBe(false);
  });

  it("only offers requests to riders with the matching vehicle type", () => {
    const b = newMotoBooking();
    const taxi = getProviders().find((p) => p.vehicle?.type === "taxi" && p.is_online && p.verification_status === "approved")!;
    expect(getIncomingForProvider(taxi.id).some((x) => x.id === b.id)).toBe(false);
  });

  it("enforces the trip state machine", () => {
    const b = newMotoBooking();
    expect(setBookingStatus(b.id, "arriving")).toBe(false); // not accepted yet
    expect(setBookingStatus(b.id, "cancelled")).toBe(true);
    expect(getBooking(b.id)?.status).toBe("cancelled");
  });

  it("completes a trip, credits the rider and recomputes the rating", () => {
    const b = newMotoBooking();
    const rider = getProviders()[0];
    const before = { trips: rider.trips_completed, earnings: rider.earnings_xaf, count: rider.rating_count };
    acceptBooking(b.id, rider.id);
    setBookingStatus(b.id, "arriving");
    setBookingStatus(b.id, "in_progress");
    expect(setBookingStatus(b.id, "completed")).toBe(true);
    expect(rider.trips_completed).toBe(before.trips + 1);
    expect(rider.earnings_xaf).toBe(before.earnings + b.fare_estimate_xaf);

    expect(rateBooking(b.id, 5, "Super")).toBe(true);
    expect(rider.rating_count).toBe(before.count + 1);
    // re-rating replaces rather than adds
    expect(rateBooking(b.id, 4, "")).toBe(true);
    expect(rider.rating_count).toBe(before.count + 1);
    expect(getBooking(b.id)?.rating).toBe(4);
  });

  it("refuses to rate a booking that is not completed", () => {
    expect(rateBooking(newMotoBooking().id, 3, "x")).toBe(false);
  });
});

describe("accounts and roles", () => {
  it("registers a user with a role that cannot be switched by re-registering", () => {
    upsertUser({ id: "u-1", phone: "+237699000111", full_name: "Awa", role: "customer" });
    upsertUser({ id: "u-1", phone: "+237699000111", full_name: "Awa B.", role: "rider" });
    const u = getUser("u-1")!;
    expect(u.role).toBe("customer");
    expect(u.full_name).toBe("Awa B.");
  });
});

describe("rider onboarding and admin verification", () => {
  it("validates required rider fields and documents", () => {
    expect(validateRegistration(RIDER_DATA).ok).toBe(true);
    const missing = validateRegistration({ ...RIDER_DATA, plate: "", documents: [DOC("id_card")] }).missing;
    expect(missing).toContain("plate");
    expect(missing).toContain("doc:license");
  });

  it("creates a pending provider that is invisible to customers until approved", () => {
    upsertUser({ id: "u-r", phone: "+237699112233", full_name: "Jean Mbarga", role: "rider" });
    const draft = saveDraft(null, "u-r", 5, RIDER_DATA);
    const p = submitDraft(draft.id)!;
    expect(p.verification_status).toBe("pending");
    expect(p.owner_user_id).toBe("u-r");
    expect(getUser("u-r")?.provider_id).toBe(p.id);
    expect(getPublicProviders().some((x) => x.id === p.id)).toBe(false);
    expect(setProviderOnline(p.id, true)).toBe(false); // cannot go online while pending

    expect(decideProvider(p.id, "approve", null)).toBe(true);
    expect(getPublicProviders().some((x) => x.id === p.id)).toBe(true);
    expect(setProviderOnline(p.id, true)).toBe(true);
  });

  it("re-queues the same provider after changes are requested", () => {
    upsertUser({ id: "u-r2", phone: "+237699112244", full_name: "Paul", role: "rider" });
    const draft = saveDraft(null, "u-r2", 5, RIDER_DATA);
    const p = submitDraft(draft.id)!;
    decideProvider(p.id, "request_changes", "Photo du permis floue");
    expect(getProvider(p.id)?.review_note).toBe("Photo du permis floue");
    saveDraft(draft.id, "u-r2", 5, { plate: "ES 999 ZZ" });
    const again = submitDraft(draft.id)!;
    expect(again.id).toBe(p.id);
    expect(again.verification_status).toBe("pending");
    expect(again.vehicle?.plate).toBe("ES 999 ZZ");
  });

  it("suspending a provider takes them offline and out of the directory", () => {
    const rider = getProviders().find((p) => p.is_online && p.verification_status === "approved")!;
    expect(decideProvider(rider.id, "suspend", "Plaintes")).toBe(true);
    expect(rider.is_online).toBe(false);
    expect(getPublicProviders().some((x) => x.id === rider.id)).toBe(false);
  });

  it("hides phone numbers of providers who do not accept direct calls", () => {
    const pub = getPublicProviders();
    const noCalls = pub.find((p) => !p.accepts_direct_calls)!;
    expect(noCalls.phone).toBeNull();
    expect(pub.find((p) => p.accepts_direct_calls)!.phone).toBeTruthy();
  });
});

describe("service providers (businesses)", () => {
  it("only lists rental vehicles of approved businesses", () => {
    const visible = getRentals();
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.every((v) => getProvider(v.provider_id)?.verification_status === "approved")).toBe(true);
    const pendingBiz = getProviders().find((p) => p.kind === "business" && p.verification_status === "pending")!;
    expect(visible.some((v) => v.provider_id === pendingBiz.id)).toBe(false);
    decideProvider(pendingBiz.id, "approve", null);
    expect(getRentals().some((v) => v.provider_id === pendingBiz.id)).toBe(true);
  });

  it("lets only the owning business answer a rental request", () => {
    const v = getRentals()[0];
    const r = createRentalRequest({ vehicle_id: v.id, customer_name: "Awa", phone: "+237699", start_date: "2026-12-01", end_date: "2026-12-03", with_driver: false })!;
    expect(r.total_xaf).toBe(3 * v.price_per_day_xaf);
    expect(respondRental(r.id, true, "someone-else")).toBe(false);
    expect(respondRental(r.id, true, v.provider_id)).toBe(true);
  });

  it("rejects rental requests with an end date before the start date", () => {
    const v = getRentals()[0];
    expect(createRentalRequest({ vehicle_id: v.id, customer_name: "A", phone: "1", start_date: "2026-12-05", end_date: "2026-12-01", with_driver: false })).toBeNull();
  });

  it("runs an express delivery end to end with the OTP check", () => {
    const courier = getProviders().find((p) => p.kind === "business" && p.services.includes("express") && p.verification_status === "approved")!;
    const parcel = createParcel({
      sender_name: "A",
      sender_phone: "1",
      receiver_name: "B",
      receiver_phone: "2",
      pickup: PICKUP,
      dropoff: DROPOFF,
      size: "small",
      photo: null,
    });
    expect(getParcelsForProvider(courier.id).some((p) => p.id === parcel.id)).toBe(true);
    expect(acceptParcel(parcel.id, courier.id)).toBe(true);
    expect(pickupParcel(parcel.id, courier.id)).toBe(true);
    expect(deliverParcel(parcel.id, "0000", courier.id)).toBe(parcel.otp === "0000");
    expect(deliverParcel(parcel.id, parcel.otp, courier.id)).toBe(true);
  });

  it("does not show parcels to providers who do not offer express", () => {
    createParcel({ sender_name: "A", sender_phone: "1", receiver_name: "B", receiver_phone: "2", pickup: PICKUP, dropoff: DROPOFF, size: "small", photo: null });
    const rental = getProviders().find((p) => p.kind === "business" && !p.services.includes("express"))!;
    expect(getParcelsForProvider(rental.id)).toHaveLength(0);
  });
});
