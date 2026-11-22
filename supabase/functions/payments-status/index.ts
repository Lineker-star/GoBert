import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  const { booking_id } = await req.json();
  return new Response(JSON.stringify({ booking_id, status: "pending" }), {
    headers: { "Content-Type": "application/json" },
  });
});
