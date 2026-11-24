import { NextRequest, NextResponse } from "next/server";
import { getProviders, estimateFare, getAISettings, logAIUsage } from "@/lib/mock-store";
import { supabase } from "@/lib/supabase";
import { embed, embedToVectorLiteral } from "@/lib/embedding";

type ToolCall = { name: string; args: Record<string, unknown>; result: unknown };
type KnowledgeChunk = { id: string; title: string; content: string };

function detectLang(q: string): "fr" | "en" {
  return /how|find|where|what|taxi|register|price/i.test(q) && !/comment|où|combien|inscri/i.test(q) ? "en" : "fr";
}

// retrieve top 4 knowledge chunks via pgvector
async function retrieveKnowledge(question: string): Promise<KnowledgeChunk[]> {
  try {
    const queryEmbedding = embedToVectorLiteral(embed(question));
    const { data, error } = await supabase.rpc("match_knowledge", {
      query_embedding: queryEmbedding,
      match_count: 4,
    });
    if (error) return [];
    return (data ?? []) as KnowledgeChunk[];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question: string = body.question ?? "";

  const settings = getAISettings();
  if (!settings.enabled) {
    return NextResponse.json({ answer: "L'assistant IA est désactivé.", disabled: true, tools: [], lang: "fr", tokens: { input: 0, output: 0 } });
  }

  const q = question.toLowerCase();
  const tools: ToolCall[] = [];
  const chunks = await retrieveKnowledge(question);

  const wantsTaxi = /taxi|course|voiture|car|ride/.test(q) && !/moto|inscri|register|devenir|provider/.test(q);
  const wantsRegister = /moto|inscri|register|devenir|prestataire|provider/.test(q);
  const wantsPricing = /prix|tarif|price|coût|cout/.test(q);
  const wantsBooking = /réserv|reserv|book|commande/.test(q);
  const wantsSafety = /sécur|secur|safety|sos/.test(q);

  let answer: string;

  if (wantsTaxi) {
    const all = getProviders().filter((p) => p.is_online);
    const taxis = all.filter((p) => p.service === "ride" || p.service === "moto");
    const near = taxis
      .map((p) => {
        const d = Math.hypot(p.last_location.lat - 4.5774, p.last_location.lng - 13.6846);
        return { name: p.display_name, rating: p.rating_avg, plate: p.vehicle.plate, dist: d };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 3);
    tools.push({ name: "search_providers", args: { near: "marché central, Bertoua", service: "taxi" }, result: near });
    const est = estimateFare({ lat: 4.5774, lng: 13.6846 }, { lat: 4.58, lng: 13.69 }, "taxi");
    tools.push({ name: "estimate_fare", args: { from: "marché central", to: "Mokolo" }, result: est });
    answer =
      `J'ai trouvé ${near.length} prestataires près du marché central :\n` +
      near.map((n) => `• ${n.name} (${n.rating}★, ${n.plate})`).join("\n") +
      `\n\nEstimation pour une course : ${est.fare_estimate_xaf} XAF (~${est.eta_min} min).`;
  } else if (wantsRegister) {
    tools.push({ name: "explain_provider_requirements", args: { service: "moto" }, result: "provider-requirements" });
    // use the top retrieved chunk (provider-requirements) if available
    const regChunk = chunks.find((c) => c.title === "provider-requirements") ?? chunks[0];
    answer = regChunk ? regChunk.content : "Pour inscrire votre moto : identité, véhicule, documents, services, horaires, vérification.";
  } else if (wantsPricing) {
    const priceChunk = chunks.find((c) => c.title === "pricing") ?? chunks[0];
    answer = priceChunk ? priceChunk.content : "Tarifs GoBert en XAF.";
  } else if (wantsBooking) {
    tools.push({ name: "get_booking_status", args: { status: "no_active" }, result: null });
    const bookChunk = chunks.find((c) => c.title === "booking-help") ?? chunks[0];
    answer = bookChunk ? bookChunk.content : "Pour réserver une course…";
  } else if (wantsSafety) {
    const safetyChunk = chunks.find((c) => c.title === "safety") ?? chunks[0];
    answer = safetyChunk ? safetyChunk.content : "Sécurité GoBert.";
  } else {
    answer =
      "Je suis l'assistant GoBert. Je peux vous renseigner sur les services, les tarifs, l'inscription des prestataires et réserver une course. Posez votre question !";
  }

  logAIUsage(question.length, answer.length);

  return NextResponse.json({
    answer,
    tools,
    chunks: chunks.map((c) => c.title),
    lang: detectLang(question),
    tokens: { input: question.length, output: answer.length },
  });
}