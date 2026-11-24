import { NextRequest, NextResponse } from "next/server";
import { getProviders, estimateFare, getAISettings, logAIUsage } from "@/lib/mock-store";

type ToolCall = { name: string; args: Record<string, unknown>; result: unknown };

const KNOWLEDGE: Record<string, string> = {
  register: `Pour inscrire votre moto sur GoBert :\n1. Identité : nom complet et téléphone (+237).\n2. Véhicule : moto, marque, modèle, immatriculation (ex. EST 123 AB), année.\n3. Documents : CNI, permis de conduire, carte grise (photos < 200 Ko).\n4. Services : type, titres FR/EN, prix, zones.\n5. Horaires : jours/heures ou 24h/24.\n6. Vérification : relisez et soumettez → statut « en attente ».\n\nUne fois approuvé, vous apparaissez sur la carte et recevez des courses.`,
  pricing: `Tarifs GoBert (XAF) :\n• Moto : 300 + 100/km\n• Taxi : 500 + 150/km\n• Tricycle : 400 + 120/km\n• Camion : 1000 + 300/km\n• Location : dès 2500/heure ou 12000/jour\nPaiement en espèces à bord.`,
  booking: `Pour réserver : 1. Choisissez la destination, 2. le véhicule, 3. consultez l'estimation, 4. confirmez. Un prestataire accepte et vous suivez son arrivée en direct. Notez la course à la fin.`,
  safety: `Sécurité : prestataires vérifiés (CNI, permis, carte grise), plaques affichées, bouton SOS, paiement en espèces à bord.`,
};

function detectLang(q: string): "fr" | "en" {
  return /how|find|where|what|taxi|register|price/i.test(q) && !/comment|où|combien|inscri/i.test(q) ? "en" : "fr";
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

  let answer: string;

  const wantsTaxi = /taxi|course|voiture|car|ride/.test(q);
  const wantsRegister = /moto|inscri|register|devenir|prestataire|provider/.test(q);
  const wantsPricing = /prix|tarif|price|coût|cout/.test(q);
  const wantsBooking = /réserv|reserv|book|course|commande/.test(q);
  const wantsSafety = /sécur|secur|safety|sos/.test(q);

  if (wantsTaxi && !wantsRegister) {
    // search_providers tool
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
    answer = KNOWLEDGE.register;
  } else if (wantsPricing) {
    answer = KNOWLEDGE.pricing;
  } else if (wantsBooking) {
    tools.push({ name: "get_booking_status", args: { status: "no_active" }, result: null });
    answer = KNOWLEDGE.booking;
  } else if (wantsSafety) {
    answer = KNOWLEDGE.safety;
  } else {
    answer =
      "Je suis l'assistant GoBert. Je peux vous renseigner sur les services, les tarifs, l'inscription des prestataires et réserver une course. Posez votre question !";
  }

  logAIUsage(question.length, answer.length);

  return NextResponse.json({
    answer,
    tools,
    lang: detectLang(question),
    tokens: { input: question.length, output: answer.length },
  });
}