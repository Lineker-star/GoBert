// Admin data API. Production: Supabase RPCs, each of which re-checks in the database
// that the caller is an admin in a 2FA (aal2) session. Demo: the web app's /api/mock.
import { supabase, USE_MOCKS } from "./supabase";

const WEB = process.env.NEXT_PUBLIC_WEB_API_URL ?? "http://localhost:3000";

export type Status = "pending" | "approved" | "rejected" | "changes_requested" | "suspended";
export type Kind = "rider" | "business";
export type Decision = "approve" | "reject" | "request_changes" | "suspend";

export type Provider = {
  id: string;
  kind: Kind;
  owner_user_id: string | null;
  display_name: string;
  phone: string;
  whatsapp: string | null;
  city: string;
  bio: string;
  rating_avg: number;
  rating_count: number;
  trips_completed: number;
  earnings_xaf: number;
  accepts_direct_calls: boolean;
  is_online: boolean;
  verification_status: Status;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  service: string;
  services: string[];
  service_details: { type: string; base_price_xaf: number; zones: string[] }[];
  vehicle: null | { type: string; brand: string; model: string; plate: string; color: string; year?: number | null; seats?: number | null; payload_kg?: number | null };
  business: null | { name: string; type: string; registration_number: string; tax_id: string; address: string; description: string };
  schedule: { days: number[]; start: string; end: string; is_24h: boolean };
  photo: string | null;
  managed_by_admin?: boolean;
  claim_phone?: string | null;
};

export type User = {
  id: string;
  phone: string;
  full_name: string;
  role: "customer" | "rider" | "business";
  email: string | null;
  city: string;
  language: string;
  provider_id: string | null;
  is_blocked?: boolean;
  created_at: string;
  verification_status: Status | null;
  provider_name: string | null;
};

export type Doc = { id: string; type: string; name: string; size: number; data_url?: string; storage_path?: string };
export type FleetVehicle = { id: string; type: string; brand: string; model: string; plate: string; price_per_day_xaf: number; price_per_hour_xaf?: number; deposit_xaf?: number; seats?: number | null; with_driver: boolean; available: boolean };
export type AuditEntry = { id: string; provider_id: string | null; decision: string; reason: string | null; at: string };
export type ProviderDetail = { provider: Provider; documents: Doc[]; owner: User | null; fleet: FleetVehicle[]; audit: AuditEntry[] };

export type Overview = {
  overview: {
    pending: number;
    approved: number;
    active: number;
    bookings_today: number;
    completed_today: number;
    revenue_today_xaf: number;
    rentals_open: number;
    parcels_open: number;
    riders: { total: number; pending: number; approved: number };
    businesses: { total: number; pending: number; approved: number };
    users: { total: number; customer: number; rider: number; business: number };
  };
  audit: AuditEntry[];
};

export type Activity = {
  bookings: { id: string; status: string; vehicle_type: string; pickup: { label: string }; dropoff: { label: string }; fare_estimate_xaf: number; fare_final_xaf: number | null; payment_method: string; created_at: string; provider_name: string | null; rating: number | null; passenger_name?: string | null }[];
  rentals: { id: string; status: string; vehicle_label: string; customer_name: string; start_date: string; end_date: string; total_xaf: number; created_at: string; provider_name: string | null }[];
  parcels: { id: string; status: string; sender_name: string; receiver_name: string; pickup: { label: string }; dropoff: { label: string }; fare_xaf: number; size: string; created_at: string; provider_name: string | null }[];
};

export type DayStat = { day: string; trips: number; completed: number; cancelled: number; revenue_xaf: number; rentals: number; parcels: number; signups: number; applications: number };
export type AuditRow = { id: string; actor: string | null; actor_name: string | null; action: string; entity: string; entity_id: string | null; reason: string | null; at: string };
export type PricingRule = { vehicle_type: string; base_fare: number; per_km: number; per_min: number; min_fare: number };
export type AISettings = { id?: string; enabled: boolean; model: string; system_prompt: string; rate_limit?: number; usage?: { requests: number; input_tokens: number; output_tokens: number } };

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${WEB}${path}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

async function send(path: string, method: string, body: unknown): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${WEB}${path}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true, data } : { ok: false, error: (data as { error?: string }).error };
  } catch {
    return { ok: false, error: "network" };
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.warn(`[admin] ${fn}: ${error.message}`);
    return null;
  }
  return data as T;
}

async function rpcResult(fn: string, args: Record<string, unknown>): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const { data, error } = await supabase.rpc(fn, args);
  return error ? { ok: false, error: error.message } : { ok: data !== false, data };
}

// ------------------------------------------------------------------ reads

/** null when the statistics function is unavailable (migration 202611260005 not applied). */
export const getStats = (days = 14): Promise<DayStat[] | null> =>
  USE_MOCKS ? get<DayStat[]>(`/api/mock/admin/stats?days=${days}`) : rpc<DayStat[]>("admin_stats", { p_days: days });
export const getOverview = () => (USE_MOCKS ? get<Overview>("/api/mock/admin/overview") : rpc<Overview>("admin_overview"));

export async function getQueue(status?: string, kind?: string): Promise<Provider[]> {
  if (USE_MOCKS) {
    const q = new URLSearchParams();
    if (status) q.set("status", status);
    if (kind) q.set("kind", kind);
    return (await get<Provider[]>(`/api/mock/admin/queue?${q.toString()}`)) ?? [];
  }
  return (await rpc<Provider[]>("admin_queue", { p_status: status ?? null, p_kind: kind ?? null })) ?? [];
}

export const getProviderDetail = (id: string) =>
  USE_MOCKS ? get<ProviderDetail>(`/api/mock/admin/providers/${id}`) : rpc<ProviderDetail>("admin_provider_detail", { p_id: id });

export async function getUsers(role?: string): Promise<User[]> {
  if (USE_MOCKS) return (await get<User[]>(`/api/mock/admin/users${role ? `?role=${role}` : ""}`)) ?? [];
  return (await rpc<User[]>("admin_users", { p_role: role ?? null })) ?? [];
}

export const getActivity = () => (USE_MOCKS ? get<Activity>("/api/mock/admin/activity") : rpc<Activity>("admin_activity"));
export const getAuditLog = async (): Promise<AuditRow[]> => (USE_MOCKS ? [] : (await rpc<AuditRow[]>("admin_audit_log")) ?? []);

/** Signed URL (5 min) for a private verification document. */
export async function documentUrl(doc: Doc): Promise<string | null> {
  if (doc.data_url) return doc.data_url;
  const path = doc.storage_path ?? "";
  if (path.startsWith("data:")) return path;
  if (!path || USE_MOCKS) return null;
  const { data } = await supabase.storage.from("provider-docs").createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function getPricing(): Promise<PricingRule[]> {
  if (USE_MOCKS) return [];
  const { data } = await supabase.from("pricing_rules").select("vehicle_type, base_fare, per_km, per_min, min_fare");
  return (data ?? []) as PricingRule[];
}

// ------------------------------------------------------------------ writes

export async function decide(id: string, decision: Decision, reason: string | null) {
  return USE_MOCKS
    ? send(`/api/mock/admin/providers/${id}/decision`, "POST", { decision, reason })
    : rpcResult("admin_decide", { p_id: id, p_decision: decision, p_reason: reason });
}

/** Create (and optionally approve) a rider or service provider from the admin console. */
export async function createProvider(kind: Kind, data: Record<string, unknown>, approve: boolean) {
  if (USE_MOCKS) return send("/api/mock/admin/providers", "POST", { kind, data, approve });
  return rpcResult("admin_create_provider", { p_kind: kind, p_data: data, p_approve: approve });
}

export async function updateProvider(id: string, data: Record<string, unknown>) {
  if (USE_MOCKS) return send(`/api/mock/admin/providers/${id}`, "PATCH", { data });
  return rpcResult("admin_update_provider", { p_id: id, p_data: data });
}

export async function blockUser(userId: string, blocked: boolean, reason: string) {
  if (USE_MOCKS) return { ok: false, error: "Disponible uniquement avec Supabase" };
  return rpcResult("admin_block_user", { p_user: userId, p_blocked: blocked, p_reason: reason });
}

export async function cancelTrip(id: string, reason: string) {
  if (USE_MOCKS) return { ok: false, error: "Disponible uniquement avec Supabase" };
  return rpcResult("admin_cancel_trip", { p_id: id, p_reason: reason });
}

export async function setPricing(r: PricingRule) {
  if (USE_MOCKS) return { ok: false, error: "Disponible uniquement avec Supabase" };
  return rpcResult("admin_set_pricing", { p_vtype: r.vehicle_type, p_base: r.base_fare, p_per_km: r.per_km, p_per_min: r.per_min, p_min: r.min_fare });
}

export async function getAISettings(): Promise<AISettings | null> {
  if (USE_MOCKS) return get<AISettings>("/api/mock/admin/ai");
  const { data } = await supabase.from("ai_settings").select("id, enabled, model, system_prompt").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return (data as AISettings) ?? { enabled: true, model: "claude-sonnet-5-5", system_prompt: "" };
}

export async function updateAISettings(patch: Partial<AISettings>): Promise<AISettings | null> {
  if (USE_MOCKS) {
    const r = await send("/api/mock/admin/ai", "PUT", patch);
    return r.ok ? (r.data as AISettings) : null;
  }
  const row = { enabled: patch.enabled, model: patch.model, system_prompt: patch.system_prompt, provider: "anthropic", updated_at: new Date().toISOString() };
  const q = patch.id ? supabase.from("ai_settings").update(row).eq("id", patch.id).select().single() : supabase.from("ai_settings").insert(row).select().single();
  const { data, error } = await q;
  return error ? null : (data as AISettings);
}
