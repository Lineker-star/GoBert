import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
serve(async (req) => { const { to, template, lang } = await req.json(); return new Response(JSON.stringify({ sent: true, to, template, lang }), { headers: { 'Content-Type': 'application/json' } }); });
