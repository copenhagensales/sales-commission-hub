import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/** Returnerer kun den offentlige VAPID-nøgle. Kræver login. */
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u, error } = await svc.auth.getUser(token);
    if (error || !u?.user) return json({ error: "Ikke logget ind" }, 401);
    return json({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") ?? null });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Fejl" }, 500);
  }
});
