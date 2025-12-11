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
    const requestBody = await req.json();
    console.log("=== ENREACH WEBHOOK MANAGER START ===");
    console.log("Raw request body:", JSON.stringify(requestBody, null, 2));

    const { integration_id, action, webhook_id, webhook_config }: ManageWebhooksRequest = requestBody;

    console.log("Parsed parameters:");
    console.log("  - integration_id:", integration_id);
    console.log("  - action:", action);
    console.log("  - webhook_id:", webhook_id);
    console.log("  - webhook_config:", JSON.stringify(webhook_config, null, 2));

    if (!integration_id || !action) {
      console.log("ERROR: Missing required parameters");
      return new Response(JSON.stringify({ success: false, error: "integration_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Managing Enreach webhooks for integration ${integration_id}, action: ${action}`);

    // Get integration details
    console.log("Fetching integration details from database...");
    const { data: integration, error: integrationError } = await supabase
      .from("dialer_integrations")
      .select("id, name, provider, api_url")
      .eq("id", integration_id)
      .single();

    console.log("Integration query result:");
    console.log("  - data:", JSON.stringify(integration, null, 2));
    console.log("  - error:", integrationError ? JSON.stringify(integrationError, null, 2) : "none");

    if (integrationError || !integration) {
      throw new Error(`Integration not found: ${integrationError?.message || "Not found"}`);
    }

    if (integration.provider !== "enreach") {
      console.log("ERROR: Not an Enreach integration, provider is:", integration.provider);
      return new Response(
        JSON.stringify({ success: false, error: "This endpoint only supports Enreach integrations" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get decrypted credentials
    console.log("Fetching decrypted credentials...");
    const { data: credentials, error: credError } = await supabase.rpc("get_dialer_credentials", {
      p_integration_id: integration_id,
      p_encryption_key: encryptionKey,
    });

    console.log("Credentials query result:");
    console.log("  - error:", credError ? JSON.stringify(credError, null, 2) : "none");
    console.log("  - has credentials:", !!credentials);

    if (credError || !credentials) {
      throw new Error(`Failed to get credentials: ${credError?.message || "No credentials"}`);
    }

    const { username, password, org_code } = credentials as { username: string; password: string; org_code?: string };

    console.log("Credentials parsed:");
    console.log("  - username:", username);
    console.log("  - password:", password ? `[${password.length} chars]` : "MISSING");
    console.log("  - org_code:", org_code || "not set");

    // For Enreach, org_code is the same as username if not explicitly set
    const orgCode = org_code || username;

    // HeroBase uses HTTP Basic Auth
    const authHeader = "Basic " + btoa(`${username}:${password}`);
    console.log("Auth header generated (base64 length):", authHeader.length);

    // Get API base URL from integration or use default
    const apiBaseUrl = integration.api_url || "https://wshero01.herobase.com/api";

    console.log("=== API Configuration ===");
    console.log("  - apiBaseUrl:", apiBaseUrl);
    console.log("  - orgCode:", orgCode);

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
        console.log("=== CREATE WEBHOOK ACTION ===");
        console.log("webhook_config received:", JSON.stringify(webhook_config, null, 2));

        if (!webhook_config?.url) {
          console.log("ERROR: Missing webhook_config.url");
          return new Response(
            JSON.stringify({ success: false, error: "webhook_config.url is required for create action" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        console.log("Building ContentTemplate...");
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
        console.log("ContentTemplate:", contentTemplate);

        // Build payload - LeadStatus is REQUIRED by HeroBase API
        // Valid values: UserProcessed, SystemProcessed, etc.
        console.log("Building payload...");
        console.log("  - webhook_config.description:", webhook_config.description);
        console.log("  - webhook_config.leadStatus:", webhook_config.leadStatus);
        console.log("  - webhook_config.campaignCode:", webhook_config.campaignCode);
        console.log("  - webhook_config.leadReleaseType:", webhook_config.leadReleaseType);

        const payload: Record<string, unknown> = {
          Name: webhook_config.description || "CPH Sales Webhook",
          Method: "POST",
          UrlTemplate: webhook_config.url,
          Format: "Json",
          ContentTemplate: contentTemplate,
          LeadStatus: webhook_config.leadStatus || "UserProcessed",
        };

        console.log("Initial payload (before CampaignCode check):", JSON.stringify(payload, null, 2));

        // Only add CampaignCode if explicitly specified (not empty string)
        if (webhook_config.campaignCode && webhook_config.campaignCode.trim() !== "") {
          console.log("Adding CampaignCode to payload:", webhook_config.campaignCode);
          payload.CampaignCode = webhook_config.campaignCode;
        } else {
          console.log("CampaignCode not added - value was:", webhook_config.campaignCode);
        }

        console.log("=== FINAL PAYLOAD TO SEND ===");
        console.log(JSON.stringify(payload, null, 2));

        const requestUrl = `${apiBaseUrl}/hooks`;
        console.log("=== MAKING REQUEST ===");
        console.log("  - URL:", requestUrl);
        console.log("  - Method: POST");
        console.log("  - Headers: Authorization (Basic), Content-Type: application/json, Accept: application/json");

        const response = await fetch(requestUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        console.log("=== RESPONSE RECEIVED ===");
        console.log("  - Status:", response.status);
        console.log("  - StatusText:", response.statusText);
        console.log("  - Headers:", JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

        const responseText = await response.text();
        console.log("  - Body:", responseText);

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
