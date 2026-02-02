import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const integrationName = body.integration_name;
    const leadId = body.lead_id;

    if (!integrationName || !leadId) {
      return new Response(JSON.stringify({ 
        error: "Missing required parameters: integration_name and lead_id" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[LeadCheck] Checking lead ${leadId} via integration ${integrationName}`);

    // Get credentials from dialer_integrations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the integration by name
    const { data: integration, error: intError } = await supabase
      .from("dialer_integrations")
      .select("id, name, encrypted_credentials")
      .ilike("name", integrationName)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ 
        error: `Integration not found: ${integrationName}`,
        details: intError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decrypt credentials
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY");
    if (!encryptionKey) {
      return new Response(JSON.stringify({ error: "DB_ENCRYPTION_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: creds, error: decryptError } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration.id,
      p_encryption_key: encryptionKey
    });

    if (decryptError || !creds) {
      return new Response(JSON.stringify({ 
        error: "Could not decrypt credentials",
        details: decryptError?.message 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { username, password } = creds;
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    const baseUrl = "https://api.adversus.io/v1";

    // Fetch lead directly by ID
    const leadUrl = `${baseUrl}/leads/${leadId}`;
    console.log(`[LeadCheck] Fetching: ${leadUrl}`);

    const leadRes = await fetch(leadUrl, {
      headers: { 
        Authorization: authHeader, 
        "Content-Type": "application/json" 
      },
    });

    if (!leadRes.ok) {
      const errorText = await leadRes.text();
      return new Response(JSON.stringify({ 
        error: `Adversus API error: ${leadRes.status}`,
        details: errorText,
        leadId 
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadData = await leadRes.json();
    const resultData = leadData.resultData || [];

    // Build result fields map (fieldId -> value)
    const resultFields: Record<number, any> = {};
    for (const field of resultData) {
      if (field && field.id !== undefined) {
        resultFields[field.id] = field.value;
      }
    }

    // Check for OPP pattern in result data
    const oppPattern = /OPP-\d{4,6}/;
    let foundOpp: string | null = null;
    let oppFieldId: number | null = null;

    for (const field of resultData) {
      if (field && field.value) {
        const match = String(field.value).match(oppPattern);
        if (match) {
          foundOpp = match[0];
          oppFieldId = field.id;
          break;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      integrationName,
      leadId,
      campaignId: leadData.campaignId,
      hasResultData: resultData.length > 0,
      resultDataCount: resultData.length,
      resultData,
      resultFields,
      foundOpp,
      oppFieldId,
      leadBasicInfo: {
        id: leadData.id,
        campaignId: leadData.campaignId,
        phone: leadData.phone,
        createdAt: leadData.createdAt,
        updatedAt: leadData.updatedAt,
        contactData: leadData.contactData,
      },
      fullLead: leadData
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[LeadCheck] Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
