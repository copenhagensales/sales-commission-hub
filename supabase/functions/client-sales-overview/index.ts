import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LeadDetail {
  id: string;
  vendor: string;
  customerName: string;
  customerPhone: string;
  saleTime: string;
  internetUnits: number;
  subscriptionUnits: number;
  closure: string;
  agent: string;
}

interface VendorStats {
  vendor: string;
  successLeads: number;
  internetUnits: number;
  subscriptionUnits: number;
  missingSubscriptionKeys: number;
  sales: LeadDetail[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "method_not_allowed" }), { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const input = await req.json() as {
      integration_id: string;
      date: string;
    };

    console.log("[ClientSalesOverview] Request:", { integration_id: input.integration_id, date: input.date });

    if (!input.integration_id) {
      return new Response(JSON.stringify({ error: "missing_integration_id" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!input.date || input.date.length !== 10) {
      return new Response(JSON.stringify({ error: "invalid_date" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch integration details
    const { data: integration, error: integrationError } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider, api_url, is_active")
      .eq("id", input.integration_id)
      .single();

    if (integrationError || !integration) {
      console.error("[ClientSalesOverview] Integration not found:", integrationError);
      return new Response(JSON.stringify({ error: "integration_not_found" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (!integration.is_active) {
      return new Response(JSON.stringify({ error: "integration_inactive" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("[ClientSalesOverview] Integration:", integration.name, integration.provider);

    // Get decrypted credentials
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    const { data: credentials, error: credError } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey,
    });

    if (credError || !credentials) {
      console.error("[ClientSalesOverview] Credential fetch failed:", credError);
      return new Response(JSON.stringify({ error: "credentials_error" }), { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log("[ClientSalesOverview] Credentials fetched for:", integration.name);

    // Only Enreach is supported for now
    if (integration.provider !== "enreach") {
      return new Response(JSON.stringify({ error: "provider_not_supported", message: "Only Enreach is supported" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // Build API URL
    const apiUrlBase = integration.api_url || credentials.api_url || "https://wshero01.herobase.com/api";
    const baseUrl = apiUrlBase.endsWith("/api") 
      ? apiUrlBase 
      : (apiUrlBase.endsWith("/") ? apiUrlBase.slice(0, -1) + "/api" : apiUrlBase + "/api");

    console.log("[ClientSalesOverview] Using API URL:", baseUrl);

    // Build auth headers
    const headers: Record<string, string> = { Accept: "application/json" };
    if (credentials.username && credentials.password) {
      headers["Authorization"] = `Basic ${btoa(`${credentials.username}:${credentials.password}`)}`;
    }

    const fromDateStr = input.date;
    const projects = "*";
    
    // Try multiple endpoint patterns
    const endpoints = [
      `/simpleleads?Projects=${encodeURIComponent(projects)}&ModifiedFrom=${fromDateStr}&ModifiedTo=${fromDateStr}&AllClosedStatuses=true`,
      `/simpleleads?Projects=${encodeURIComponent(projects)}&ModifiedFrom=${fromDateStr}&AllClosedStatuses=true`,
    ];

    // deno-lint-ignore no-explicit-any
    async function fetchArray(ep: string): Promise<any[]> {
      const url = `${baseUrl}${ep}`;
      console.log("[ClientSalesOverview] Fetching:", url);
      
      const resp = await fetch(url, { headers });
      if (!resp.ok) {
        console.error("[ClientSalesOverview] API error:", resp.status, resp.statusText);
        return [];
      }
      
      const payload = await resp.json();
      // deno-lint-ignore no-explicit-any
      const arr = Array.isArray(payload) ? payload : ((payload.Results ?? payload.results ?? payload.Leads ?? payload.leads ?? []) as any[]);
      return Array.isArray(arr) ? arr : [];
    }

    // deno-lint-ignore no-explicit-any
    let raw: any[] = [];
    for (const ep of endpoints) {
      const arr = await fetchArray(ep);
      if (arr.length > 0) { 
        raw = arr; 
        break; 
      }
    }

    console.log("[ClientSalesOverview] Fetched leads:", raw.length);

    // deno-lint-ignore no-explicit-any
    function isSuccessEnreach(l: any): boolean {
      const cRaw = (l.closure ?? l.Closure) as string | undefined;
      const c = typeof cRaw === "string" ? cRaw.trim().toLowerCase() : "";
      if (c === "success") return true;
      // deno-lint-ignore no-explicit-any
      const dataObj = (l.data ?? l.Data) as Record<string, any> | undefined;
      const afsl = dataObj ? String((dataObj["Afslutning"] ?? dataObj["afslutning"] ?? "")).trim().toLowerCase() : "";
      return afsl === "accepteret" || afsl === "accepted";
    }

    function ymdLocal(ms: number): string { 
      const d = new Date(ms); 
      const y = d.getFullYear(); 
      const m = String(d.getMonth() + 1).padStart(2, "0"); 
      const dy = String(d.getDate()).padStart(2, "0"); 
      return `${y}-${m}-${dy}`; 
    }

    // deno-lint-ignore no-explicit-any
    function chooseSaleTime(l: any): string | undefined {
      const lm = l.lastModifiedTime as string | undefined;
      const fp = l.firstProcessedTime as string | undefined;
      return lm && lm.length > 0 ? lm : (fp && fp.length > 0 ? fp : undefined);
    }

    const vendors = new Map<string, VendorStats>();
    
    for (const l of raw) {
      const st = chooseSaleTime(l);
      if (!st) continue;
      
      const ms = new Date(st.includes(" ") ? st.replace(" ", "T") : st).getTime();
      if (Number.isNaN(ms)) continue;
      
      const day = ymdLocal(ms);
      if (day !== fromDateStr) continue;
      
      // deno-lint-ignore no-explicit-any
      const dataObj = (l.data ?? l.Data) as Record<string, any> | undefined;
      const vendorName = dataObj ? String((dataObj["SurveyLeverandør"] ?? dataObj["surveyleverandør"] ?? "")).trim().toLowerCase() : "";
      const vKey = vendorName || "";
      
      if (!vendors.has(vKey)) {
        vendors.set(vKey, { 
          vendor: vKey, 
          successLeads: 0, 
          internetUnits: 0, 
          subscriptionUnits: 0, 
          missingSubscriptionKeys: 0,
          sales: []
        });
      }
      
      const vstats = vendors.get(vKey)!;
      const success = isSuccessEnreach(l);
      
      if (success) {
        const internetQty = parseInt(String((dataObj?.["5GI salg"] ?? dataObj?.["5gi salg"] ?? "0")).trim() || "0") || 0;
        const subsQty = parseInt(String((dataObj?.["Antal abonnementer"] ?? dataObj?.["antal abonnementer"] ?? dataObj?.["Antal abon."] ?? "0")).trim() || "0") || 0;
        
        vstats.successLeads += 1;
        vstats.internetUnits += internetQty;
        vstats.subscriptionUnits += subsQty;
        
        // Add sale detail
        const leadId = String(l.leadId ?? l.id ?? "");
        const customerName = String(dataObj?.["Navn"] ?? dataObj?.["navn"] ?? dataObj?.["Kundenavn"] ?? "").trim();
        const customerPhone = String(l.phone ?? l.Phone ?? dataObj?.["Telefon"] ?? "").trim();
        const agent = String(l.lastModifiedByUser?.name ?? l.lastModifiedBy ?? dataObj?.["Sælger"] ?? "").trim();
        const closure = String(l.closure ?? l.Closure ?? "").trim();
        
        vstats.sales.push({
          id: leadId,
          vendor: vKey,
          customerName,
          customerPhone,
          saleTime: st,
          internetUnits: internetQty,
          subscriptionUnits: subsQty,
          closure,
          agent
        });
        
        if (subsQty > 0) {
          let found = 0;
          for (let i = 1; i <= subsQty; i++) {
            const key = `Abonnement${i}`;
            // deno-lint-ignore no-explicit-any
            const val = (dataObj as any)?.[key] ?? (dataObj as any)?.[key.toLowerCase()];
            if (val !== undefined && String(val).length > 0) found++;
          }
          const missing = subsQty - found;
          if (missing > 0) vstats.missingSubscriptionKeys += missing;
        }
      }
    }

    const rows = Array.from(vendors.values()).sort((a, b) => b.successLeads - a.successLeads);
    
    console.log("[ClientSalesOverview] Result:", rows.length, "vendors");

    return new Response(JSON.stringify({ rows }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (e) {
    console.error("[ClientSalesOverview] Error:", e);
    return new Response(JSON.stringify({ 
      error: "internal_error", 
      message: String((e as Error)?.message ?? e) 
    }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
