import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const integrationId = "a76cf63a-4b02-4d99-b6b5-20a8e4552ba5";
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");

    const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integrationId,
      p_encryption_key: encryptionKey,
    });

    if (!credentials) {
      return new Response(JSON.stringify({ error: "no_credentials" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const baseUrl = "https://wshero01.herobase.com/api";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (credentials.username && credentials.password) {
      headers["Authorization"] = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
    }

    const today = new Date().toISOString().slice(0, 10);
    
    // Try multiple URL variations
    const urls = [
      `${baseUrl}/leads?searchName=cphsales&ModifiedFrom=${today}`,
      `${baseUrl}/leads?SearchName=cphsales&ModifiedFrom=${today}`,
      `${baseUrl}/leads?searchName=cphsales&modifiedFrom=${today}`,
      `${baseUrl}/leads?searchName=cphsales`,
      `${baseUrl}/leads/cphsales?ModifiedFrom=${today}`,
    ];

    const results: Record<string, unknown>[] = [];

    for (const url of urls) {
      console.log("[TestASE] Trying:", url);
      const resp = await fetch(url, { headers });
      const text = await resp.text();
      console.log("[TestASE] Status:", resp.status, "Body:", text.slice(0, 500));
      
      results.push({
        url: url.replace(baseUrl, ""),
        status: resp.status,
        bodyPreview: text.slice(0, 500),
        bodyLength: text.length,
      });

      // If we got a 200, parse and analyze
      if (resp.status === 200) {
        try {
          const parsed = JSON.parse(text);
          const isArr = Array.isArray(parsed);
          const count = isArr ? parsed.length : (parsed.Results?.length ?? parsed.results?.length ?? "N/A");
          results[results.length - 1].parsed = {
            isArray: isArr,
            count,
            topKeys: isArr ? (parsed.length > 0 ? Object.keys(parsed[0]) : []) : Object.keys(parsed),
            firstItem: isArr ? parsed[0] : (parsed.Results?.[0] ?? parsed.results?.[0] ?? null),
            secondItem: isArr && parsed.length > 1 ? parsed[1] : null,
          };
        } catch { /* skip */ }
        break; // Stop on first success
      }
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error("[TestASE] Error:", e);
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
