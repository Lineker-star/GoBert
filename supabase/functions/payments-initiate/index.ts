import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const { booking_id, method, amount_xaf } = await req.json();
  // aggregator abstraction: swap implementation here
  return new Response(JSON.stringify({ status: "initiated", booking_id, method, amount_xaf }), {
    headers: { "Content-Type": "application/json" },
  });
});
