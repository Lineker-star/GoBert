import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const { message, language } = await req.json();
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return new Response("missing key", { status: 500 });
  // call Claude API here; RAG retrieval from ai_knowledge
  return new Response(JSON.stringify({ reply: "Bonjour ! Comment puis-je vous aider ?", language }), {
    headers: { "Content-Type": "application/json" },
  });
});
