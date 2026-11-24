import type { RegistrationData, RegistrationDraft } from "./mock-store";

const USE_MOCKS = typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_MOCKS === "true";

async function mockFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json() as Promise<T>;
}

export async function saveDraft(
  draftId: string | null,
  userId: string,
  step: number,
  data: RegistrationData,
): Promise<RegistrationDraft> {
  return mockFetch<RegistrationDraft>("/api/mock/registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft_id: draftId, user_id: userId, step, data }),
  });
}

export async function getDraft(id: string): Promise<RegistrationDraft | null> {
  return mockFetch<RegistrationDraft>(`/api/mock/registration?id=${id}`).catch(() => null);
}

export type SubmitResult = { id: string; verification_status: string; display_name: string };

export async function submitDraft(draftId: string): Promise<SubmitResult> {
  return mockFetch<SubmitResult>("/api/mock/registration/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draft_id: draftId }),
  });
}

export async function getProviderStatus(providerId: string): Promise<string | null> {
  const p = await mockFetch<{ verification_status: string }>(`/api/mock/providers/${providerId}`).catch(
    () => null,
  );
  return p?.verification_status ?? null;
}