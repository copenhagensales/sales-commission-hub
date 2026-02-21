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

    const now = new Date();
    const yesterdayFull = new Date(now.getTime() - 86400000).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    
    // Try lowercase parameter names (maybe case-sensitive)
    await testEndpoint("leads_lower_params", `${baseUrl}/leads?searchName=cphsales2&modifiedFrom=${yesterday}`);
    await testEndpoint("leads_lower_searchname", `${baseUrl}/leads?searchname=cphsales2&ModifiedFrom=${yesterday}`);
    
    // Try with full ISO datetime instead of date-only
    await testEndpoint("leads_iso_datetime", `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${yesterdayFull}`);
    
    // Try with wider date range (week ago)
    await testEndpoint("leads_week_ago", `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${weekAgo}`);
    
    // Try with European date format (dd.MM.yyyy as shown in screenshot)
    const eurDate = `${yesterday.slice(8,10)}.${yesterday.slice(5,7)}.${yesterday.slice(0,4)}`;
    await testEndpoint("leads_eu_date", `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${eurDate}`);
    
    // Try searchName as path segment instead of query param
    await testEndpoint("leads_path_segment", `${baseUrl}/leads/cphsales2?ModifiedFrom=${yesterday}`);
    
    // Try with view parameter (maybe it's called view not SearchName)
    await testEndpoint("leads_view", `${baseUrl}/leads?View=cphsales2&ModifiedFrom=${yesterday}`);
    await testEndpoint("leads_filter", `${baseUrl}/leads?Filter=cphsales2&ModifiedFrom=${yesterday}`);
    await testEndpoint("leads_name", `${baseUrl}/leads?Name=cphsales2&ModifiedFrom=${yesterday}`);
    
    // Try /leads/search endpoint
    await testEndpoint("leads_search_ep", `${baseUrl}/leads/search?SearchName=cphsales2&ModifiedFrom=${yesterday}`);
    await testEndpoint("leads_search_ep2", `${baseUrl}/leads/search/cphsales2?ModifiedFrom=${yesterday}`);
    
    // Try /export endpoint
    await testEndpoint("leads_export", `${baseUrl}/export/leads?SearchName=cphsales2&ModifiedFrom=${yesterday}`);
    
    // Try requesting as streamable format
    await testEndpoint("leads_stream", `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${yesterday}&format=stream`);
    
    // Try rawleads with SearchName (maybe this param works there)
    await testEndpoint("rawleads_csv_search", `${baseUrl}/rawleads/csv?SearchName=cphsales2&ModifiedFrom=${yesterday}`, "text/csv");

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
