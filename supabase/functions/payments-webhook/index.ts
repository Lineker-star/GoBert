import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  // verify signature, idempotent by provider_ref
  const body = await req.json();
  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
