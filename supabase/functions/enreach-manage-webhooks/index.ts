import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireCronOrOwner } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// [B3-rest 4/11] HeroBase-kald fra denne funktion fejlede gentagne gange med »http2 error: connection error … unspecific protocol error« fra samme
// genbrugte forbindelse, mens andre funktioner nåede samme host. Alle kald mod HeroBase går derfor gennem fetchHero: ét genforsøg efter 400 ms,
// og ved transportfejl bruges en frisk klient uden HTTP/2 (hvis runtime'en tillader det). Ingen ændring af svar eller logik.
const fetchHero = async (url: string, init: RequestInit): Promise<Response> => {
  try { return await fetch(url, init); }
  catch (e) {
    const besked = e instanceof Error ? e.message : String(e);
    if (!/http2|connection|SendRequest|reset/i.test(besked)) throw e;
    await new Promise((r) => setTimeout(r, 400));
    try {
      const skab = (Deno as unknown as { createHttpClient?: (o: Record<string, unknown>) => unknown }).createHttpClient;
      if (typeof skab === "function") {
        const klient = skab({ http1: true, http2: false });
        return await fetch(url, { ...init, client: klient } as RequestInit);
      }
    } catch { /* fald tilbage til almindelig fetch */ }
    return await fetch(url, init);
  }
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
    headers?: Record<string, string>; // [B3] faste headers, HeroBase sender med (fx x-webhook-secret) – aldrig logget
    standardTemplateName?: string;   // [B3] fx "PostJson" – HeroBase' egen JSON-skabelon (payload = lead-objektet med uniqueId, campaignId, closure, status, firstProcessedByUser …)
    contentTemplate?: string;        // [B3] egen skabelon (JSON-tekst med HeroBase' placeholders); bruges kun, hvis standardTemplateName mangler
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
  // [B3] Kun ejer (UI) eller cron-hemmelighed (drift): funktionen opretter/sletter hooks hos HeroBase med kontoens legitimation og var før åben for enhver med anon-nøglen
  const auth = await requireCronOrOwner(req);
  if (auth instanceof Response) return auth;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const requestBody = await req.json();
    const { integration_id, action, webhook_id, webhook_config }: ManageWebhooksRequest = requestBody;

    if (!integration_id || !action) {
      return new Response(JSON.stringify({ success: false, error: "integration_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const orgCode = org_code || username;
    const authHeader = "Basic " + btoa(`${username}:${password}`);
    const apiBaseUrl = integration.api_url || "https://wshero01.herobase.com/api";

    // Execute the requested action
    switch (action) {
      case "list": {
        const response = await fetchHero(`${apiBaseUrl}/hooks`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HeroBase API error: ${response.status}`);
        }

        const webhooks = await response.json();

        // [B3-rest] Headers (kan indeholde hook-hemmeligheder) udelades af svaret
        const udenHeaders = (h: unknown) => (h && typeof h === "object" ? Object.fromEntries(Object.entries(h as Record<string, unknown>).filter(([k]) => k.toLowerCase() !== "headers")) : h);
        const webhooksUdenHeaders = Array.isArray(webhooks) ? webhooks.map(udenHeaders) : webhooks;
        return new Response(JSON.stringify({ success: true, webhooks: webhooksUdenHeaders }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "campaigns": {
        // Fetch available campaigns from HeroBase
        const response = await fetchHero(`${apiBaseUrl}/campaigns`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HeroBase API error: ${response.status}`);
        }

        const campaigns = await response.json();

        return new Response(JSON.stringify({ success: true, campaigns }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "meta": {
        // Get metadata about webhook configuration options
        const response = await fetchHero(`${apiBaseUrl}/hooks/meta`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HeroBase API error: ${response.status}`);
        }

        const meta = await response.json();

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

        const response = await fetchHero(`${apiBaseUrl}/hooks/${webhook_id}/example`, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        const responseText = await response.text();

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
          throw new Error(`HeroBase API error: ${response.status}`);  // [B3] intet råt svar i fejl/konsol
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
          Method: "POST",
          UrlTemplate: webhook_config.url,
          Format: "Json",
          LeadStatus: webhook_config.leadStatus || "UserProcessed",
        };
        // [B3] Skabelon: HeroBase' standardskabelon (fx PostJson) eller egen skabelon; ellers den hidtidige (hvis placeholders HeroBase ikke kender → tomme felter)
        if (webhook_config.standardTemplateName && webhook_config.standardTemplateName.trim() !== "") payload.StandardTemplateName = webhook_config.standardTemplateName.trim();
        else payload.ContentTemplate = webhook_config.contentTemplate && webhook_config.contentTemplate.trim() !== "" ? webhook_config.contentTemplate : contentTemplate;

        if (webhook_config.campaignCode && webhook_config.campaignCode.trim() !== "") {
          payload.CampaignCode = webhook_config.campaignCode;
        }
        if (webhook_config.headers && Object.keys(webhook_config.headers).length > 0) payload.Headers = JSON.stringify(webhook_config.headers);  // [B3]

        const response = await fetchHero(`${apiBaseUrl}/hooks`, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responseText = await response.text();

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
              kode: response.status === 400 ? "HEROBASE_AFVIST" : response.status === 401 || response.status === 403 ? "HEROBASE_ADGANG" : response.status === 429 ? "HEROBASE_KVOTE" : "HEROBASE_FEJL",  // [B3] faste koder – svaret kan gengive Headers (hemmelighed) og logges aldrig
              url_host: (() => { try { return new URL(webhook_config.url).host; } catch { return "ugyldig"; } })(),
            },
          });

          throw new Error(`HeroBase API error: ${response.status}`);
        }

        let result: HeroBaseHook | null = null;
        try {
          result = JSON.parse(responseText);
        } catch {
          // Could not parse
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
            url_host: (() => { try { return new URL(webhook_config.url).host; } catch { return "ugyldig"; } })(),  // [B3] aldrig hele URL'en (authKey i querystring)
          },
        });

        return new Response(
          JSON.stringify({
            success: true,
            webhook: result && typeof result === "object" ? Object.fromEntries(Object.entries(result as unknown as Record<string, unknown>).filter(([k]) => k.toLowerCase() !== "headers")) : result,  // [B3-rest] aldrig headers i svar
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

        const response = await fetchHero(`${apiBaseUrl}/hooks/${webhook_id}`, {
          method: "DELETE",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HeroBase API error: ${response.status}`);
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
