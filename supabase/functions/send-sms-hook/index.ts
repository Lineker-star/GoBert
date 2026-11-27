// Supabase Auth "Send SMS" hook → SMS Gateway for Android (sms-gate.app).
//
// Supabase calls this function every time it needs to text a sign-in code. The request
// is signed (Standard Webhooks); anything unsigned is refused. The code is then sent
// from your own Android phone + SIM through the SMS Gateway cloud API.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET   the "v1,whsec_…" secret shown when you create the hook
//   SMSGATE_USERNAME       from the SMS Gateway app (Settings → Cloud server)
//   SMSGATE_PASSWORD       from the SMS Gateway app
//   SMSGATE_URL            optional, defaults to https://api.sms-gate.app/3rdparty/v1/message
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const fail = (status: number, message: string) => json({ error: { http_code: status, message } }, status);

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail(405, "method not allowed");

  const hookSecret = Deno.env.get("SEND_SMS_HOOK_SECRET");
  const user = Deno.env.get("SMSGATE_USERNAME");
  const pass = Deno.env.get("SMSGATE_PASSWORD");
  if (!hookSecret || !user || !pass) return fail(500, "SMS gateway is not configured");

  const payload = await req.text();
  let data: { user: { phone?: string }; sms: { otp: string } };
  try {
    const wh = new Webhook(hookSecret.replace(/^v1,whsec_/, ""));
    data = wh.verify(payload, Object.fromEntries(req.headers)) as typeof data;
  } catch {
    return fail(401, "invalid signature");
  }

  const digits = (data.user?.phone ?? "").replace(/\D/g, "");
  const otp = String(data.sms?.otp ?? "");
  if (!digits || !/^\d{4,10}$/.test(otp)) return fail(400, "missing phone or code");

  const text = `GoBert : votre code est ${otp}. Ne le partagez avec personne. / Your code is ${otp}.`;
  const url = Deno.env.get("SMSGATE_URL") ?? "https://api.sms-gate.app/3rdparty/v1/message";
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Basic ${btoa(`${user}:${pass}`)}`, "Content-Type": "application/json" },
      // Codes expire quickly: don't let the phone send a stale one hours later.
      body: JSON.stringify({ textMessage: { text }, phoneNumbers: [`+${digits}`], ttl: 300 }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return fail(502, "SMS gateway unreachable");
  }
  if (!res.ok) return fail(502, `SMS gateway refused the message (${res.status})`);
  return json({});
});
