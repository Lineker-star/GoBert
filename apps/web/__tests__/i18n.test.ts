import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";

type Tree = { [k: string]: string | Tree };

function keys(obj: Tree, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => (typeof v === "string" ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`)));
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" || e.name.startsWith(".") || e.name === "api" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}

const enKeys = new Set(keys(en as Tree));

describe("i18n", () => {
  it("French and English have exactly the same keys", () => {
    const frKeys = new Set(keys(fr as Tree));
    expect([...enKeys].filter((k) => !frKeys.has(k))).toEqual([]);
    expect([...frKeys].filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("covers every key built dynamically from domain values", () => {
    const services = ["moto", "ride", "express", "cargo", "rent", "logistics"];
    const statuses = ["requested", "accepted", "arriving", "in_progress", "completed", "cancelled", "expired", "confirmed", "declined", "active", "in_transit", "delivered", "pending", "approved", "rejected", "changes_requested", "suspended"];
    const verif = ["pending", "approved", "changes_requested", "rejected", "suspended"];
    const notif = ["provider_submitted", "provider_approved", "provider_rejected", "provider_changes_requested", "provider_suspended", "booking_accepted", "rental_requested", "rental_confirmed", "rental_declined", "parcel_accepted", "parcel_delivered"];
    const required = [
      ...services.flatMap((s) => [`services.${s}.name`, `services.${s}.desc`]),
      ...["customer", "rider", "business"].flatMap((r) => ["label", "short", "title", "desc", "cta", "point1", "point2", "point3"].map((k) => `roles.${r}.${k}`)),
      ...["customer", "rider", "business"].map((r) => `auth.signupTitle.${r}`),
      ...statuses.map((s) => `status.${s}`),
      ...["requested", "accepted", "arriving", "in_progress", "completed", "cancelled", "expired"].map((s) => `booking.status.${s}`),
      ...verif.flatMap((s) => [`verification.${s}.title`, `verification.${s}.desc`]),
      ...notif.map((n) => `notifications.kind.${n}`),
      ...["moto", "taxi", "tricycle", "truck"].flatMap((v) => [`vehicleTypes.${v}`, `booking.vehicleHint.${v}`]),
      ...["car", "van", "truck", "moto", "tricycle"].map((v) => `rentalTypes.${v}`),
      ...["delivery", "car_rental", "logistics", "other"].flatMap((b) => [`businessTypes.${b}.name`, `businessTypes.${b}.desc`]),
      ...["id_card", "license", "registration", "insurance", "rider_photo", "business_registration", "manager_id", "tax_card"].map((d) => `documents.${d}`),
      ...["cash", "mtn_momo", "orange_money"].flatMap((p) => [`payments.${p}`, `booking.paymentHint.${p}`, `booking.paidWith.${p}`]),
      ...["0", "1", "2", "3", "4", "5", "6"].map((d) => `days.${d}`),
      ...["about", "vehicle", "documents", "services", "schedule", "review", "company", "fleet"].flatMap((s) => [`onboard.steps.${s}`, `onboard.hints.${s}`]),
      ...["full_name", "phone", "vehicle_type", "brand", "model", "plate", "year", "business_name", "business_type", "registration_number", "address", "doc", "services", "price", "days", "hours"].map((e) => `onboard.errors.${e}`),
      ...["small", "medium", "large"].flatMap((s) => [`parcelSizes.${s}.name`, `parcelSizes.${s}.desc`]),
      ...["requested", "confirmed", "declined", "active", "completed", "cancelled"].flatMap((s) => [`rent.statusTitle.${s}`, `rent.statusHint.${s}`]),
      ...["requested", "accepted", "in_transit", "delivered", "cancelled"].map((s) => `express.statusTitle.${s}`),
      ...["rate_limited", "invalid_otp", "network", "anonymous_disabled", "sms_disabled", "invalid_phone", "invalid_email", "name_required", "role_required", "terms_required", "generic"].map((e) => `auth.errors.${e}`),
    ];
    expect(required.filter((k) => !enKeys.has(k))).toEqual([]);
  });

  it("every static t('…') key used in the UI exists", () => {
    const root = path.resolve(__dirname, "..");
    const files = [...walk(path.join(root, "app")), ...walk(path.join(root, "components"))];
    const missing: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      // Namespaced translators: useTranslations("nav") → prefix "nav." (a file may use several).
      const namespaces = [...src.matchAll(/useTranslations\("([\w.]+)"\)/g)].map((m) => m[1]);
      for (const m of src.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
        const found = enKeys.has(m[1]) || namespaces.some((ns) => enKeys.has(`${ns}.${m[1]}`));
        if (!found) missing.push(`${path.relative(root, f)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
