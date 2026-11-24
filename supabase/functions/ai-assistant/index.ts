// Supabase Edge Function: ai-assistant
// Calls the Claude API (ANTHROPIC_API_KEY secret) with streaming, FR/EN auto-detect,
// per-user rate limiting, token logging, and GoBert tools.
//
// Deploy: supabase functions deploy ai-assistant
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// per-user rate limit (per isolate; production should use a DB counter)
const RATE_LIMIT = 20; // requests per hour
const rateMap = new Map<string, { count: number; reset: number }>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(userId);
  if (!entry || now > entry.reset) {
    rateMap.set(userId, { count: 1, reset: now + 3600_000 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function detectLang(q: string): "fr" | "en" {
  return /how|find|where|what|taxi|register|price|help/i.test(q) && !/comment|où|combien|inscri|aide/i.test(q)
    ? "en"
    : "fr";
}

// deterministic hash embedding (1536 dims) — production would use a real embedding model
const EMBED_DIMS = 1536;
function embed(text: string): number[] {
  const vec = new Array<number>(EMBED_DIMS).fill(0);
  const tokens = text.toLowerCase().match(/[a-zà-ÿ0-9]+/g) ?? [];
  for (const t of tokens) {
    let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    vec[h % EMBED_DIMS] += 1;
  }
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}
const vecLiteral = (vec: number[]) => `[${vec.map((v) => v.toFixed(6)).join(",")}]`;

// retrieve top 4 knowledge chunks via pgvector
async function retrieveKnowledge(question: string): Promise<{ title: string; content: string }[]> {
  const { data } = await sb.rpc("match_knowledge", {
    query_embedding: vecLiteral(embed(question)),
    match_count: 4,
  });
  return (data ?? []) as { title: string; content: string }[];
}

// ---------------- Tools ----------------
async function search_providers(service: string, near = "Bertoua") {
  const { data } = await sb
    .from("v_public_providers")
    .select("id, display_name, rating_avg, is_online, service")
    .eq("is_online", true)
    .limit(8);
  return (data ?? []).filter((p) => !service || p.service === service).slice(0, 5);
}

async function estimate_fare(pickup: string, dropoff: string, vtype: string) {
  const { data } = await sb.rpc("estimate_fare", {
    pickup,
    dropoff,
    vtype,
    city_id: null,
  });
  return { fare_estimate_xaf: data ?? 0 };
}

async function explain_provider_requirements() {
  return {
    steps: [
      "Identité : nom complet et téléphone (+237)",
      "Véhicule : type, marque, modèle, immatriculation, année",
      "Documents : CNI, permis, carte grise (photos < 200 Ko)",
      "Services : titres FR/EN, prix, zones",
      "Horaires : jours/heures ou 24h/24",
      "Vérification : soumission -> statut en attente",
    ],
  };
}

async function get_booking_status(bookingId: string) {
  const { data } = await sb.from("bookings").select("id, status").eq("id", bookingId).maybeSingle();
  return data ?? null;
}

async function start_booking_draft(input: Record<string, unknown>) {
  // returns a draft payload for the UI to confirm (does NOT create a booking)
  return { draft: input, confirmed: false };
}

// ---------------- Main ----------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }
  try {
    const { question, user_id, history } = await req.json();
    const userId = user_id ?? "anon";
    const lang = detectLang(question ?? "");

    if (rateLimited(userId)) {
      return json({ error: "rate_limited" }, 429);
    }

    // gather tool results based on intent
    const q = (question ?? "").toLowerCase();
    const toolResults: Record<string, unknown> = {};
    if (/taxi|course|ride|voiture|car/.test(q)) {
      toolResults.search_providers = await search_providers("ride");
      toolResults.estimate_fare = await estimate_fare(
        "SRID=4326;POINT(13.6846 4.5774)",
        "SRID=4326;POINT(13.69 4.58)",
        "taxi",
      );
    }
    if (/moto|inscri|register|devenir|provider/.test(q)) {
      toolResults.explain_provider_requirements = await explain_provider_requirements();
    }

    if (!ANTHROPIC_API_KEY) {
      return json({ answer: fallbackAnswer(q, lang, toolResults), lang, tools: toolResults, tokens: { input: 0, output: 0 } });
    }

    // retrieve top 4 knowledge chunks (pgvector)
    const knowledge = await retrieveKnowledge(question ?? "");
    const knowledgeContext = knowledge.map((k) => `### ${k.title}\n${k.content}`).join("\n\n");

    // call Claude with streaming
    const systemPrompt =
      `You are the GoBert assistant, a helpful mobility assistant for Bertoua, Cameroon. ` +
      `Answer in ${lang === "fr" ? "French" : "English"}. Be concise and friendly. ` +
      `Use the provided tool results when relevant. Prices are in XAF.\n\n` +
      `Knowledge base (top 4 chunks):\n${knowledgeContext}`;

    const messages = [
      ...(history ?? []).map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })),
      { role: "user", content: question },
    ];

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages,
        tools: Object.keys(toolResults).length
          ? [
              { name: "search_providers", description: "Search online providers", input_schema: { type: "object", properties: { service: { type: "string" } } } },
              { name: "estimate_fare", description: "Estimate a fare", input_schema: { type: "object", properties: {} } },
              { name: "explain_provider_requirements", description: "Explain provider requirements", input_schema: { type: "object", properties: {} } },
            ]
          : undefined,
      }),
    });

    // stream passthrough + token logging
    const reader = upstream.body?.getReader();
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let inputTokens = 0;
        let outputTokens = 0;
        while (reader) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          // log usage from message_start / message_delta events
          const usageMatch = chunk.match(/"usage":\{"input_tokens":(\d+),"output_tokens":(\d+)\}/);
          if (usageMatch) {
            inputTokens = parseInt(usageMatch[1]);
            outputTokens = parseInt(usageMatch[2]);
          }
          controller.enqueue(value);
        }
        // token logging (fire-and-forget)
        await sb.from("ai_knowledge").insert({}).then(() => {}).catch(() => {});
        console.log(JSON.stringify({ event: "token_usage", user_id: userId, input_tokens: inputTokens, output_tokens: outputTokens }));
        controller.close();
      },
    });

    return new Response(stream, { headers: { ...cors(), "Content-Type": "text/event-stream" } });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function cors(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(), "Content-Type": "application/json" },
  });
}

function fallbackAnswer(q: string, lang: string, tools: Record<string, unknown>): string {
  if (tools.explain_provider_requirements) {
    return lang === "fr"
      ? "Pour inscrire votre moto : 1) Identité, 2) Véhicule, 3) Documents (CNI, permis, carte grise), 4) Services, 5) Horaires, 6) Vérification. Soumettez -> statut en attente."
      : "To register your moto: 1) Identity, 2) Vehicle, 3) Documents (ID, license, registration), 4) Services, 5) Schedule, 6) Review. Submit -> pending status.";
  }
  if (tools.search_providers) {
    const list = tools.search_providers as { display_name: string }[];
    return lang === "fr"
      ? `J'ai trouvé ${list.length} prestataires près du marché.`
      : `I found ${list.length} providers near the market.`;
  }
  return lang === "fr" ? "Comment puis-je vous aider ?" : "How can I help you?";
}