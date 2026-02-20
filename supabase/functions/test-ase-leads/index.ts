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

    const baseUrl = "https://wshero01.herobase.com/api";
    
    // Use stored credentials
    const headers: Record<string, string> = { Accept: "application/json" };
    if (credentials?.username && credentials?.password) {
      headers["Authorization"] = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
      console.log("[TestASE] Using stored creds, username:", credentials.username);
    }

    const today = new Date().toISOString().slice(0, 10);
    
    // Try the leads endpoint variations
    const urls = [
      `${baseUrl}/leads?searchName=cphsales&ModifiedFrom=${today}`,
      `${baseUrl}/leads?searchName=cphsales&ModifiedFrom=${today}&PageSize=10`,
      `${baseUrl}/leads?searchName=cphsales&ModifiedFrom=${today}&take=10`,
    ];

    const results: Record<string, unknown>[] = [];

    // First log what user the API is using
    results.push({ storedUsername: credentials?.username ?? "N/A" });

    for (const url of urls) {
      console.log("[TestASE] Trying:", url);
      const resp = await fetch(url, { headers });
      const text = await resp.text();
      console.log("[TestASE]", resp.status, text.slice(0, 300));
      
      const entry: Record<string, unknown> = {
        url: url.replace(baseUrl, ""),
        status: resp.status,
        bodyPreview: text.slice(0, 1000),
        bodyLength: text.length,
      };

      if (resp.status === 200) {
        try {
          const parsed = JSON.parse(text);
          const isArr = Array.isArray(parsed);
          entry.isArray = isArr;
          if (isArr) {
            entry.count = parsed.length;
            if (parsed.length > 0) {
              entry.firstItemKeys = Object.keys(parsed[0]);
              entry.firstItem = parsed[0];
            }
          } else {
            entry.topKeys = Object.keys(parsed);
            // Check nested arrays
            for (const k of Object.keys(parsed)) {
              if (Array.isArray(parsed[k])) {
                entry[`${k}_count`] = parsed[k].length;
                if (parsed[k].length > 0) {
                  entry[`${k}_firstKeys`] = Object.keys(parsed[k][0]);
                  entry[`${k}_first`] = parsed[k][0];
                }
              }
            }
          }
        } catch { /* skip */ }
        break;
      }

      results.push(entry);
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
