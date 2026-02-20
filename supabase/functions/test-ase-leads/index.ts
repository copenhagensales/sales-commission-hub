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
    
    // Trim credentials
    const username = credentials?.username?.trim();
    const password = credentials?.password?.trim();
    const headers: Record<string, string> = { Accept: "application/json" };
    if (username && password) {
      headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
      console.log("[TestASE] Trimmed username:", JSON.stringify(username), "len:", username.length);
      console.log("[TestASE] Trimmed password len:", password.length);
    }

    const today = new Date().toISOString().slice(0, 10);
    
    // Try multiple approaches
    const urls = [
      // 1. Without searchName - just ModifiedFrom
      `${baseUrl}/leads?ModifiedFrom=${today}`,
      // 2. With cphsales2
      `${baseUrl}/leads?searchName=cphsales2&ModifiedFrom=${today}`,
      // 3. With DialTimeFrom instead of ModifiedFrom
      `${baseUrl}/leads?searchName=cphsales2&DialTimeFrom=${today}`,
      // 4. Try campaigns endpoint to verify auth works at all
      `${baseUrl}/campaigns`,
    ];

    const results: Record<string, unknown>[] = [];
    results.push({ storedUsername: username ?? "N/A", passwordLen: password?.length ?? 0 });

    for (const url of urls) {
      console.log("[TestASE] Trying:", url);
      const resp = await fetch(url, { headers });
      const text = await resp.text();
      console.log("[TestASE]", resp.status, text.slice(0, 500));
      
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
            for (const k of Object.keys(parsed)) {
              if (Array.isArray(parsed[k])) {
                entry[`${k}_count`] = parsed[k].length;
                if (parsed[k].length > 0) {
                  entry[`${k}_firstKeys`] = Object.keys(parsed[k][0]);
                }
              }
            }
          }
        } catch { /* skip */ }
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
