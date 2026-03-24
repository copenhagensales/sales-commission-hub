import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const saleId = body.saleId || "1238515";
    const leadId = body.leadId || "974658141";
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get credentials
    const { data: integrations } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider")
      .eq("is_active", true)
      .ilike("name", "Lovablecph");

    const integration = integrations?.[0];
    if (!integration) throw new Error("No integration found");

    const { data: credentials } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY"),
    });

    const user = credentials?.username || credentials?.ADVERSUS_API_USERNAME;
    const pass = credentials?.password || credentials?.ADVERSUS_API_PASSWORD;
    const authHeader = "Basic " + btoa(`${user}:${pass}`);

    const results: any = {};

    // 1. Try /sales/{id}
    try {
      const r1 = await fetch(`https://api.adversus.io/v1/sales/${saleId}`, {
        headers: { Authorization: authHeader },
      });
      results.sale_endpoint = { status: r1.status, data: r1.ok ? await r1.json() : await r1.text() };
    } catch (e) { results.sale_endpoint = { error: String(e) }; }

    // 2. Try /sales/{id}?include=resultData
    try {
      const r2 = await fetch(`https://api.adversus.io/v1/sales/${saleId}?include=resultData`, {
        headers: { Authorization: authHeader },
      });
      results.sale_with_include = { status: r2.status, data: r2.ok ? await r2.json() : await r2.text() };
    } catch (e) { results.sale_with_include = { error: String(e) }; }

    // 3. Try /leads/{id}
    try {
      const r3 = await fetch(`https://api.adversus.io/v1/leads/${leadId}`, {
        headers: { Authorization: authHeader },
      });
      results.lead_endpoint = { status: r3.status, data: r3.ok ? await r3.json() : await r3.text() };
    } catch (e) { results.lead_endpoint = { error: String(e) }; }

    // 4. Try /sales with filters for this specific sale
    try {
      const filters = JSON.stringify({ id: { "$eq": Number(saleId) } });
      const r4 = await fetch(`https://api.adversus.io/sales?filters=${encodeURIComponent(filters)}&pageSize=1`, {
        headers: { Authorization: authHeader },
      });
      results.sales_list_by_id = { status: r4.status, data: r4.ok ? await r4.json() : await r4.text() };
    } catch (e) { results.sales_list_by_id = { error: String(e) }; }

    // 5. Try /orders/{id}
    try {
      const r5 = await fetch(`https://api.adversus.io/v1/orders/${saleId}`, {
        headers: { Authorization: authHeader },
      });
      results.order_endpoint = { status: r5.status, data: r5.ok ? await r5.json() : await r5.text() };
    } catch (e) { results.order_endpoint = { error: String(e) }; }

    // 6. Try /leads?filters with the specific leadId
    try {
      const filters = JSON.stringify({ id: { "$eq": Number(leadId) } });
      const r6 = await fetch(`https://api.adversus.io/leads?filters=${encodeURIComponent(filters)}&pageSize=1`, {
        headers: { Authorization: authHeader },
      });
      results.leads_list_by_id = { status: r6.status, data: r6.ok ? await r6.json() : await r6.text() };
    } catch (e) { results.leads_list_by_id = { error: String(e) }; }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
