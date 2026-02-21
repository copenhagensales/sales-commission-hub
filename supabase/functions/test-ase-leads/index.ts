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

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    
    // Trailing slash variations
    await testEndpoint("leads_trailing", `${baseUrl}/leads/?SearchName=cphsales2&ModifiedFrom=${yesterday}`);
    
    // Without any query params at all - just the endpoint
    await testEndpoint("leads_bare", `${baseUrl}/leads/`);
    await testEndpoint("leads_bare2", `${baseUrl}/leads`);
    
    // Try with Include as first param (maybe order matters)
    await testEndpoint("leads_include_first", `${baseUrl}/leads?Include=campaign,lastModifiedByUser,firstProcessedByUser&SearchName=cphsales2&ModifiedFrom=${yesterday}`);
    
    // Try the Tryg integration credentials on /leads to see if it's user-specific
    const trygIntegrationId = "a5068f85-da1c-43e1-8e57-92cc5c4749f1";
    const { data: trygCreds } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: trygIntegrationId,
      p_encryption_key: encryptionKey,
    });
    const trygUser = trygCreds?.username?.trim();
    const trygPass = trygCreds?.password?.trim();
    if (trygUser && trygPass) {
      const trygAuth = `Basic ${btoa(`${trygUser}:${trygPass}`)}`;
      // Try /leads on wshero01 with Tryg credentials
      console.log(`[TestASE] Testing /leads with Tryg user: ${trygUser}`);
      try {
        const r = await fetch(`${baseUrl}/leads?ModifiedFrom=${yesterday}`, {
          headers: { Authorization: trygAuth, Accept: "application/json" }
        });
        const t = await r.text();
        results.push({ name: "leads_tryg_user", status: r.status, bytes: t.length, preview: t.slice(0, 300), user: trygUser });
      } catch (e) { results.push({ name: "leads_tryg_user", error: (e as Error).message }); }
      
      // Try /simpleleads on wshero01 with Tryg credentials  
      try {
        const r = await fetch(`${baseUrl}/simpleleads?Projects=*&ModifiedFrom=${yesterday}&AllClosedStatuses=true`, {
          headers: { Authorization: trygAuth, Accept: "application/json" }
        });
        const t = await r.text();
        results.push({ name: "simpleleads_tryg_user", status: r.status, bytes: t.length, preview: t.slice(0, 300), user: trygUser });
      } catch (e) { results.push({ name: "simpleleads_tryg_user", error: (e as Error).message }); }
    } else {
      results.push({ name: "tryg_creds", note: "No Tryg credentials found" });
    }
    
    // Try Eesy integration credentials on /leads (different server wshero06)
    const eesyIntegrationId = "d79b9632-1cac-4744-ab30-7768e580c794";
    const { data: eesyCreds } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: eesyIntegrationId,
      p_encryption_key: encryptionKey,
    });
    const eesyUser = eesyCreds?.username?.trim();
    const eesyPass = eesyCreds?.password?.trim();
    if (eesyUser && eesyPass) {
      const eesyAuth = `Basic ${btoa(`${eesyUser}:${eesyPass}`)}`;
      // Try /leads on wshero06 with Eesy credentials
      console.log(`[TestASE] Testing /leads with Eesy user: ${eesyUser}`);
      try {
        const r = await fetch(`https://wshero06.herobase.com/api/leads?ModifiedFrom=${yesterday}`, {
          headers: { Authorization: eesyAuth, Accept: "application/json" }
        });
        const t = await r.text();
        results.push({ name: "leads_eesy_user", status: r.status, bytes: t.length, preview: t.slice(0, 300), user: eesyUser });
      } catch (e) { results.push({ name: "leads_eesy_user", error: (e as Error).message }); }
    } else {
      results.push({ name: "eesy_creds", note: "No Eesy credentials found" });
    }
    
    // Standard test for reference
    await testEndpoint("leads_standard", `${baseUrl}/leads?SearchName=cphsales2&ModifiedFrom=${yesterday}&Include=campaign,lastModifiedByUser,firstProcessedByUser`);

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
