import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const { booking_id, lat, lng, vehicle_type, radius_m } = await req.json();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: providers } = await supabase.rpc("nearby_providers", {
    lat,
    lng,
    radius_m: radius_m ?? 2000,
    vehicle_type_filter: vehicle_type,
  });
  for (const p of providers ?? []) {
    await supabase.from("booking_offers").insert({ booking_id, provider_id: p.id });
  }
  return new Response(JSON.stringify({ offered: providers?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});
