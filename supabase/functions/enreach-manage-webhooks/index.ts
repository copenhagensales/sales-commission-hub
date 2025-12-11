import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManageWebhooksRequest {
  integration_id: string;
  action: "list" | "create" | "delete" | "meta" | "campaigns" | "example";
  webhook_id?: string;
  webhook_config?: {
    url: string;
    secret?: string;
    description?: string;
    events?: string[];
    leadStatus?: string;
    leadReleaseType?: string;
    campaignCode?: string;
  };
}

interface HeroBaseHook {
  id: string;
  url: string;
  description?: string;
  createdDate?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { integration_id, action, webhook_id, webhook_config }: ManageWebhooksRequest = await req.json();

    if (!integration_id || !action) {
      return new Response(JSON.stringify({ success: false, error: "integration_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Managing Enreach webhooks for integration ${integration_id}, action: ${action}`);

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider, api_url")
      .eq("id", integration_id)
      .single();

    if (integrationError || !integration) {
      throw new Error(`Integration not found: ${integrationError?.message || "Not found"}`);
    }

    if (integration.provider !== "enreach") {
      return new Response(
        JSON.stringify({ success: false, error: "This endpoint only supports Enreach integrations" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get decrypted credentials
    const { data: credentials, error: credError } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration_id,
      p_encryption_key: encryptionKey,
    });

    if (credError || !credentials) {
      throw new Error(`Failed to get credentials: ${credError?.message || "No credentials"}`);
    }

    const { username, password, org_code } = credentials as { username: string; password: string; org_code?: string };

    // For Enreach, org_code is the same as username if not explicitly set
    const orgCode = org_code || username;

    // HeroBase uses HTTP Basic Auth
    const authHeader = "Basic " + btoa(`${username}:${password}`);

    // Get API base URL from integration or use default
    const apiBaseUrl = integration.api_url || "https://wshero01.herobase.com/api";

    console.log(`Using HeroBase API at: ${apiBaseUrl}, orgCode: ${orgCode}`);

    // Execute the requested action
    switch (action) {
      case "list": {
        const response = await fetch(`${apiBaseUrl}/hooks`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HeroBase list webhooks error: ${response.status} - ${errorText}`);
          throw new Error(`HeroBase API error: ${response.status} - ${errorText}`);
        }

        const webhooks = await response.json();
        console.log(`Found ${Array.isArray(webhooks) ? webhooks.length : 0} webhooks`);

        return new Response(JSON.stringify({ success: true, webhooks }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "campaigns": {
        // Fetch available campaigns from HeroBase
        const response = await fetch(`${apiBaseUrl}/campaigns`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HeroBase campaigns error: ${response.status} - ${errorText}`);
          throw new Error(`HeroBase API error: ${response.status} - ${errorText}`);
        }

        const campaigns = await response.json();
        console.log(`Found ${Array.isArray(campaigns) ? campaigns.length : 0} campaigns`);

        return new Response(JSON.stringify({ success: true, campaigns }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "meta": {
        // Get metadata about webhook configuration options
        const response = await fetch(`${apiBaseUrl}/hooks/meta`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HeroBase hooks meta error: ${response.status} - ${errorText}`);
          throw new Error(`HeroBase API error: ${response.status} - ${errorText}`);
        }

        const meta = await response.json();
        console.log("HeroBase hooks meta:", JSON.stringify(meta));

        return new Response(JSON.stringify({ success: true, meta }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "example": {
        if (!webhook_id) {
          return new Response(
            JSON.stringify({ success: false, error: "webhook_id is required for example action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        console.log(`Fetching example payload for webhook ${webhook_id}`);

        // First try to get real example from HeroBase
        const response = await fetch(`${apiBaseUrl}/hooks/${webhook_id}/example`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        const responseText = await response.text();
        console.log(`HeroBase example response status: ${response.status}`);
        console.log(`HeroBase example response: ${responseText}`);

        // If successful, return real example
        if (response.ok) {
          let example: unknown = null;
          try {
            example = JSON.parse(responseText);
          } catch {
            example = responseText;
          }
          return new Response(JSON.stringify({ success: true, example, isRealData: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // If no real data available, fetch actual leads to create a real example
        console.log("No example from HeroBase, attempting to fetch recent leads for synthetic example...");
        
        try {
          // Try to get a recent lead from the simpleleads endpoint
          const today = new Date().toISOString().split('T')[0];
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          const leadsUrl = `${apiBaseUrl}/simpleleads?Projects=*&ModifiedFrom=${thirtyDaysAgo}&Statuses=UserProcessed&LeadClosures=Success`;
          console.log(`Fetching leads from: ${leadsUrl}`);
          
          const leadsResponse = await fetch(leadsUrl, {
            method: "GET",
            headers: {
              Authorization: authHeader,
              Accept: "application/json",
            },
          });

          if (leadsResponse.ok) {
            const leadsText = await leadsResponse.text();
            let leads: unknown[] = [];
            try {
              leads = JSON.parse(leadsText);
            } catch {
              console.log("Could not parse leads response");
            }

            if (Array.isArray(leads) && leads.length > 0) {
              // Use the most recent lead as example
              const sampleLead = leads[0] as Record<string, unknown>;
              console.log(`Found ${leads.length} leads, using first as example`);
              
              // Build example in the same format as our ContentTemplate
              const syntheticExample = {
                UniqueId: sampleLead.UniqueId || sampleLead.uniqueId || "SAMPLE-12345",
                AgentEmail: sampleLead.AgentEmail || sampleLead.agentEmail || "agent@example.com",
                AgentName: sampleLead.UserName || sampleLead.userName || sampleLead.AgentName || "Agent Name",
                CampaignCode: sampleLead.CampaignCode || sampleLead.campaignCode || "CAMP001",
                CampaignName: sampleLead.CampaignName || sampleLead.campaignName || "Campaign Name",
                LeadStatus: sampleLead.LeadStatus || sampleLead.leadStatus || "UserProcessed",
                CustomerPhone: sampleLead.PhoneNumber || sampleLead.phoneNumber || "+45 12345678",
                CustomerName: sampleLead.ContactName || sampleLead.contactName || "Customer Name",
                CustomerCompany: sampleLead.Company || sampleLead.company || "Company A/S",
                ClosedDate: sampleLead.ClosedDate || sampleLead.closedDate || new Date().toISOString(),
                Result: sampleLead.Result || sampleLead.result || "Sale",
                _source: "Real lead data from HeroBase",
                _note: "Dette er baseret på en faktisk lead fra de seneste 30 dage"
              };

              return new Response(JSON.stringify({ 
                success: true, 
                example: syntheticExample,
                isRealData: true,
                message: "Eksempel genereret fra faktisk lead-data"
              }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
          }
        } catch (leadErr) {
          console.error("Error fetching leads for example:", leadErr);
        }

        // Fallback: Return a template-based example showing expected structure
        console.log("No leads found, returning template-based example");
        const templateExample = {
          UniqueId: "EXAMPLE-UUID-12345",
          AgentEmail: "agent@yourcompany.dk",
          AgentName: "Agent Fornavn Efternavn",
          CampaignCode: "CAMPAIGN_CODE",
          CampaignName: "Kampagne Navn",
          LeadStatus: "UserProcessed",
          CustomerPhone: "+45 12 34 56 78",
          CustomerName: "Kunde Fornavn Efternavn",
          CustomerCompany: "Kunde Virksomhed A/S",
          ClosedDate: new Date().toISOString(),
          Result: "Sale",
          _source: "Template structure",
          _note: "Dette er en skabelon - faktiske data vil have rigtige værdier fra HeroBase"
        };

        return new Response(JSON.stringify({ 
          success: true, 
          example: templateExample,
          isRealData: false,
          message: "Ingen historiske data fundet. Viser forventet payload-struktur."
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        if (!webhook_config?.url) {
          return new Response(
            JSON.stringify({ success: false, error: "webhook_config.url is required for create action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // ContentTemplate con variables estándar de Enreach/HeroBase
        const contentTemplate = JSON.stringify({
          UniqueId: "{UniqueId}",
          AgentEmail: "{AgentEmail}",
          AgentName: "{UserName}",
          CampaignCode: "{CampaignCode}",
          CampaignName: "{CampaignName}",
          LeadStatus: "{LeadStatus}",
          CustomerPhone: "{PhoneNumber}",
          CustomerName: "{ContactName}",
          CustomerCompany: "{Company}",
          ClosedDate: "{ClosedDate}",
          Result: "{Result}",
        });

        const payload: Record<string, unknown> = {
          Name: webhook_config.description || "CPH Sales Webhook",
          CampaignCode: webhook_config.campaignCode,
          LeadStatus: webhook_config.leadStatus || "UserProcessed",
          Method: "POST",
          UrlTemplate: webhook_config.url,
          Format: "Json",
          ContentTemplate: contentTemplate,
        };

        // CAMBIO 3: LeadReleaseType comentado - causa "Sequence contains no matching element"
        // si el valor exacto no existe en la lista de resultados de la campaña
        // Es mejor crear el webhook abierto y filtrar en el código receptor
        /*
        if (webhook_config.leadReleaseType) {
          payload.LeadReleaseType = webhook_config.leadReleaseType;
        }
        */

        console.log("Creating HeroBase webhook with payload:", JSON.stringify(payload));

        const response = await fetch(`${apiBaseUrl}/hooks`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();
        console.log(`HeroBase create response status: ${response.status}`);
        console.log(`HeroBase create response: ${responseText}`);

        if (!response.ok) {
          // Log the error
          await supabase.from("integration_logs").insert({
            integration_type: "dialer",
            integration_id: integration_id,
            integration_name: integration.name,
            status: "error",
            message: `Failed to create webhook in HeroBase: ${response.status}`,
            details: {
              status: response.status,
              response: responseText,
              url: webhook_config.url,
            },
          });

          throw new Error(`HeroBase API error: ${response.status} - ${responseText}`);
        }

        let result: HeroBaseHook | null = null;
        try {
          result = JSON.parse(responseText);
        } catch {
          console.log("Could not parse webhook response");
        }

        // Log success
        await supabase.from("integration_logs").insert({
          integration_type: "dialer",
          integration_id: integration_id,
          integration_name: integration.name,
          status: "success",
          message: `Webhook created in HeroBase`,
          details: {
            webhook_id: result?.id,
            url: webhook_config.url,
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            webhook: result,
            message: `Webhook created successfully`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "delete": {
        if (!webhook_id) {
          return new Response(JSON.stringify({ success: false, error: "webhook_id is required for delete action" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const response = await fetch(`${apiBaseUrl}/hooks/${webhook_id}`, {
          method: "DELETE",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`HeroBase delete webhook error: ${response.status} - ${errorText}`);
          throw new Error(`HeroBase API error: ${response.status} - ${errorText}`);
        }

        // Log success
        await supabase.from("integration_logs").insert({
          integration_type: "dialer",
          integration_id: integration_id,
          integration_name: integration.name,
          status: "success",
          message: `Webhook ${webhook_id} deleted from HeroBase`,
          details: { webhook_id },
        });

        return new Response(JSON.stringify({ success: true, message: `Webhook ${webhook_id} deleted successfully` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Error managing Enreach webhooks:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
