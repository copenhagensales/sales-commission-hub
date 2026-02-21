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
    const username = credentials?.username?.trim();
    const password = credentials?.password?.trim();
    const authHeader = username && password ? `Basic ${btoa(`${username}:${password}`)}` : "";

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    
    const results: Record<string, unknown>[] = [];
    results.push({ user: username, passwordLen: password?.length ?? 0 });

    // deno-lint-ignore no-explicit-any
    async function testEndpoint(name: string, url: string, accept = "application/json"): Promise<any> {
      console.log(`[TestASE] ${name}: ${url}`);
      try {
        const resp = await fetch(url, { headers: { Authorization: authHeader, Accept: accept } });
        const text = await resp.text();
        console.log(`[TestASE] ${name}: ${resp.status} (${text.length} bytes)`);
        
        const entry: Record<string, unknown> = { name, status: resp.status, bytes: text.length };

        if (resp.status === 200 && text.length > 0) {
          if (accept === "text/csv") {
            const lines = text.split("\n");
            entry.lineCount = lines.length;
            entry.headerRow = lines[0]?.slice(0, 300);
            entry.sampleRow = lines[1]?.slice(0, 300);
          } else {
            try {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                entry.count = parsed.length;
                if (parsed.length > 0) {
                  const first = parsed[0];
                  entry.keys = Object.keys(first);
                  entry.sample = {
                    uniqueId: first.uniqueId,
                    status: first.status,
                    closure: first.closure,
                    lastModifiedTime: first.lastModifiedTime,
                    firstProcessedTime: first.firstProcessedTime,
                    dataKeys: first.data ? Object.keys(first.data) : null,
                    dataSample: first.data ? Object.fromEntries(Object.entries(first.data).slice(0, 8)) : null,
                    campaign: first.campaign,
                    lastModifiedByUser: first.lastModifiedByUser,
                    firstProcessedByUser: first.firstProcessedByUser,
                  };
                  // Closure distribution
                  const cl: Record<string, number> = {};
                  for (const l of parsed) cl[l.closure || "null"] = (cl[l.closure || "null"] || 0) + 1;
                  entry.closures = cl;
                }
              } else {
                entry.topKeys = Object.keys(parsed);
                entry.preview = text.slice(0, 300);
              }
            } catch {
              entry.preview = text.slice(0, 300);
            }
          }
        } else {
          entry.preview = text.slice(0, 300);
        }
        results.push(entry);
      } catch (e) {
        results.push({ name, error: (e as Error).message });
      }
    }

    // Try different API base URLs
    const altBases = [
      "https://wshero01.herobase.com/api",
      "https://wshero01.herobase.com/api/v1",
      "https://wshero01.herobase.com/api/v2",
      "https://api.herobase.com/api",
    ];
    
    for (const base of altBases) {
      await testEndpoint(`leads_${base.split('/').pop()}`, `${base}/leads?SearchName=cphsales2&ModifiedFrom=${yesterday}`);
    }
    
    // Try with explicit Accept and Content-Type headers
    console.log(`[TestASE] leads_explicit_headers`);
    try {
      const r = await fetch(`${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${yesterday}`, {
        headers: { 
          Authorization: authHeader, 
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest"
        }
      });
      const t = await r.text();
      results.push({ name: "leads_explicit_headers", status: r.status, preview: t.slice(0, 300) });
    } catch (e) { results.push({ name: "leads_explicit_headers", error: (e as Error).message }); }
    
    // Try activities endpoint (similar to leads)
    await testEndpoint("activities", `${baseUrl}/activities?ModifiedFrom=${yesterday}`);
    
    // Try webhooks
    await testEndpoint("webhooks", `${baseUrl}/webhooks`);
    
    // Try the rawleads (non-csv) JSON endpoint variants
    await testEndpoint("rawleads_json_project", `${baseUrl}/rawleads?Projects=${encodeURIComponent("Nysalg - Eksterne")}&ModifiedFrom=${yesterday}`);
    await testEndpoint("rawleads_csv_project", `${baseUrl}/rawleads/csv?Projects=${encodeURIComponent("Nysalg - Eksterne")}&ModifiedFrom=${yesterday}`, "text/csv");

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
