const WEB = process.env.NEXT_PUBLIC_WEB_API_URL ?? "http://localhost:3000";

export type QueueProvider = {
  id: string;
  display_name: string;
  rating_avg: number;
  rating_count: number;
  is_online: boolean;
  verification_status: string;
  last_location: { lat: number; lng: number };
  service: string;
  vehicle: { type: string; brand: string; model: string; plate: string; color: string };
  photo: string;
};

export async function adminLogin(email: string, password: string): Promise<boolean> {
  const res = await fetch(`${WEB}/api/mock/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.ok;
}

export async function getQueue(status?: string): Promise<QueueProvider[]> {
  const res = await fetch(`${WEB}/api/mock/admin/queue${status ? `?status=${status}` : ""}`);
  if (!res.ok) return [];
  return res.json();
}

export type ProviderDetail = {
  provider: QueueProvider;
  documents: { id: string; type: string; name: string; size: number; data_url: string }[];
  draft: null | { data: { services?: unknown[]; schedule?: unknown } };
};

export async function getProviderDetail(id: string): Promise<ProviderDetail | null> {
  const res = await fetch(`${WEB}/api/mock/admin/providers/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function decide(
  id: string,
  decision: "approve" | "reject" | "request_changes" | "suspend",
  reason: string | null,
): Promise<boolean> {
  const res = await fetch(`${WEB}/api/mock/admin/providers/${id}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision, reason }),
  });
  return res.ok;
}

export type Overview = {
  overview: { pending: number; approved: number; active: number; bookings_today: number };
  audit: { id: string; provider_id: string | null; decision: string; reason: string | null; at: string }[];
};

export async function getOverview(): Promise<Overview | null> {
  const res = await fetch(`${WEB}/api/mock/admin/overview`);
  if (!res.ok) return null;
  return res.json();
}

export type AISettings = {
  enabled: boolean;
  model: string;
  system_prompt: string;
  rate_limit: number;
  usage: { requests: number; input_tokens: number; output_tokens: number };
};

export async function getAISettings(): Promise<AISettings | null> {
  const res = await fetch(`${WEB}/api/mock/admin/ai`);
  if (!res.ok) return null;
  return res.json();
}

export async function updateAISettings(patch: Partial<AISettings>): Promise<AISettings | null> {
  const res = await fetch(`${WEB}/api/mock/admin/ai`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) return null;
  return res.json();
}