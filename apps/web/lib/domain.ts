// Domain constants shared by the client and the (server-only) mock store.
import type { BusinessType, ServiceKey, VehicleType } from "./mock-store";

export type RiderVehicle = Exclude<VehicleType, "car_rental">;

export const RIDER_VEHICLES: RiderVehicle[] = ["moto", "taxi", "tricycle", "truck"];

/** Which services a rider may offer, by vehicle type. */
export const RIDER_SERVICES: Record<RiderVehicle, ServiceKey[]> = {
  moto: ["moto", "express"],
  taxi: ["ride", "express"],
  tricycle: ["ride", "express", "cargo"],
  truck: ["cargo"],
};

export const PRIMARY_SERVICE: Record<VehicleType, ServiceKey> = {
  moto: "moto",
  taxi: "ride",
  tricycle: "express",
  truck: "cargo",
  car_rental: "rent",
};

export const BUSINESS_TYPES: BusinessType[] = ["delivery", "car_rental", "logistics", "other"];
export const BUSINESS_SERVICES: ServiceKey[] = ["express", "rent", "cargo", "logistics", "ride"];

export const BUSINESS_PRIMARY: Record<BusinessType, ServiceKey> = {
  delivery: "express",
  car_rental: "rent",
  logistics: "logistics",
  other: "cargo",
};

/** Suggested starting prices in XAF (riders can change them). */
export const DEFAULT_BASE_PRICE: Record<ServiceKey, number> = {
  moto: 300,
  ride: 500,
  express: 500,
  cargo: 2000,
  rent: 15000,
  logistics: 5000,
};

export const RIDER_DOCS = [
  { type: "id_card", required: true },
  { type: "license", required: true },
  { type: "registration", required: true },
  { type: "insurance", required: false },
  { type: "rider_photo", required: false },
] as const;

export const BUSINESS_DOCS = [
  { type: "business_registration", required: true },
  { type: "manager_id", required: true },
  { type: "tax_card", required: false },
  { type: "insurance", required: false },
] as const;
