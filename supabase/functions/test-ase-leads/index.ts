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

    // 1. /leads WITHOUT SearchName (just ModifiedFrom) 
    await testEndpoint("leads_no_search", `${baseUrl}/leads?ModifiedFrom=${yesterday}&Include=campaign,lastModifiedByUser,firstProcessedByUser`);

    // 2. /leads with different SearchName variations
    await testEndpoint("leads_cphsales", `${baseUrl}/leads?SearchName=cphsales&ModifiedFrom=${yesterday}`);
    await testEndpoint("leads_CPHsales2", `${baseUrl}/leads?SearchName=CPHsales2&ModifiedFrom=${yesterday}`);
    
    // 3. /rawleads JSON (not CSV)
    await testEndpoint("rawleads_json", `${baseUrl}/rawleads?Projects=*&ModifiedFrom=${yesterday}&AllClosedStatuses=true`);

    // 4. /rawleads/csv with Include (if supported)
    await testEndpoint("rawleads_csv_yesterday", `${baseUrl}/rawleads/csv?Projects=*&ModifiedFrom=${yesterday}&AllClosedStatuses=true`, "text/csv");

    // 5. List saved searches / lead segments
    await testEndpoint("leadsegments", `${baseUrl}/leadsegments`);
    await testEndpoint("searches", `${baseUrl}/searches`);
    await testEndpoint("savedsearches", `${baseUrl}/savedsearches`);

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
