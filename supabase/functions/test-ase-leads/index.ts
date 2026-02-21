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
    const headers: Record<string, string> = { Accept: "application/json" };
    if (username && password) {
      headers["Authorization"] = `Basic ${btoa(`${username}:${password}`)}`;
    }

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    
    const results: Record<string, unknown>[] = [];
    results.push({ user: username, passwordLen: password?.length ?? 0 });

    // Test 1: /leads with SearchName=cphsales2 + ModifiedFrom (required combo per docs)
    const tests: [string, string, Record<string, string>?][] = [
      ["leads_searchName_modifiedFrom", `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${yesterday}`, undefined],
      ["leads_searchName_dialTimeFrom", `${baseUrl}/leads?SearchName=cphsales2&DialTimeFrom=${yesterday}`, undefined],
      ["leads_csv_searchName", `${baseUrl}/leads/csv?SearchName=cphsales2&ModifiedFrom=${yesterday}`, { Accept: "text/csv" }],
      ["rawleads_csv_projects_star", `${baseUrl}/rawleads/csv?Projects=*&ModifiedFrom=${yesterday}&AllClosedStatuses=true`, { Accept: "text/csv" }],
      ["rawleads_csv_project_nysalg", `${baseUrl}/rawleads/csv?Projects=Nysalg*&ModifiedFrom=${yesterday}&AllClosedStatuses=true`, { Accept: "text/csv" }],
      ["rawleads_csv_statuses_userprocessed", `${baseUrl}/rawleads/csv?Projects=*&ModifiedFrom=${yesterday}&Statuses=UserProcessed`, { Accept: "text/csv" }],
      ["leaddefinitions", `${baseUrl}/leaddefinitions`, undefined],
      ["leadsegments", `${baseUrl}/leadsegments`, undefined],
      ["users", `${baseUrl}/users`, undefined],
      ["calls_csv_today", `${baseUrl}/calls/csv?OrgCode=${username}&StartTime=${today}&TimeSpan=1.00:00:00`, { Accept: "text/csv" }],
      ["reporting_examples", `${baseUrl}/reporting/examples`, undefined],
      ["myaccount", `${baseUrl}/myaccount`, undefined],
      ["organizationalunits", `${baseUrl}/organizationalunits`, undefined],
      ["leads_export_example", `${baseUrl}/leads/export_example?CampaignCode=CAMP5396S3012`, undefined],
    ];

    for (const [name, url, extraHeaders] of tests) {
      console.log(`[TestASE] Testing: ${name} -> ${url}`);
      try {
        const reqHeaders = { ...headers, ...(extraHeaders || {}) };
        const resp = await fetch(url, { headers: reqHeaders });
        const text = await resp.text();
        console.log(`[TestASE] ${name}: ${resp.status} (${text.length} bytes)`);
        
        const entry: Record<string, unknown> = {
          name,
          url: url.replace(baseUrl, ""),
          status: resp.status,
          contentType: resp.headers.get("content-type"),
          bodyLength: text.length,
          bodyPreview: text.slice(0, 500),
        };

        if (resp.status === 200 && text.length > 0) {
          try {
            const parsed = JSON.parse(text);
            entry.isArray = Array.isArray(parsed);
            if (Array.isArray(parsed)) {
              entry.count = parsed.length;
              if (parsed.length > 0) entry.firstItemKeys = Object.keys(parsed[0]);
              if (parsed.length > 0) entry.firstItem = parsed[0];
            } else {
              entry.topKeys = Object.keys(parsed);
            }
          } catch {
            // CSV or other format - count lines
            const lines = text.split("\n");
            entry.lineCount = lines.length;
            entry.firstLines = lines.slice(0, 5);
          }
        }

        results.push(entry);
      } catch (e) {
        results.push({ name, error: (e as Error).message });
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
