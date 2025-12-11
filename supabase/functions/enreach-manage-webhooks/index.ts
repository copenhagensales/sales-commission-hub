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

        if (!response.ok) {
          // Check for common error cases
          if (responseText.includes("Sequence contains no matching element")) {
            return new Response(JSON.stringify({ 
              success: true, 
              example: null,
              message: "Ingen eksempeldata tilgængelig. Webhook'en skal modtage mindst én hændelse for at generere et eksempel."
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          throw new Error(`HeroBase API error: ${response.status} - ${responseText}`);
        }

        let example: unknown = null;
        try {
          example = JSON.parse(responseText);
        } catch {
          // If not JSON, return as text
          example = responseText;
        }

        return new Response(JSON.stringify({ success: true, example }), {
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

        // Build payload - LeadStatus is REQUIRED by HeroBase API
        // Using "Closed" which is broader than "UserProcessed" to match more leads for /example
        const payload: Record<string, unknown> = {
          Name: webhook_config.description || "CPH Sales Webhook",
          Method: "POST",
          UrlTemplate: webhook_config.url,
          Format: "Json",
          ContentTemplate: contentTemplate,
          LeadStatus: webhook_config.leadStatus || "Closed",
        };

        // Only add CampaignCode if explicitly specified (not empty string)
        if (webhook_config.campaignCode && webhook_config.campaignCode.trim() !== "") {
          payload.CampaignCode = webhook_config.campaignCode;
        }

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
