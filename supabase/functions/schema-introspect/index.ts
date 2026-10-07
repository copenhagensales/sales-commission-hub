// Skrivebeskyttet skema-udtræk til ekstern revision.
// Returnerer KUN databasens metadata via public.introspect_schema() — aldrig tabelrækker.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-introspect-token, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  // Hash begge først, så længden ikke lækker og sammenligningen er fast længde.
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json(405, { error: "Method not allowed" });

  const expected = Deno.env.get("INTROSPECT_TOKEN") ?? "";
  const provided = req.headers.get("x-introspect-token") ?? "";
  const ok = await constantTimeEqual(provided, expected);
  if (!expected || !provided || !ok) return json(401, { error: "Unauthorized" });

  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await svc.rpc("introspect_schema");
    if (error) return json(500, { error: "Introspection failed" });
    return json(200, data);
  } catch {
    return json(500, { error: "Introspection failed" });
  }
});
