import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============ ADAPTER INTERFACES ============
interface CrmAdapter {
  name: string;
  validateSale(sale: SaleRecord, config: Record<string, unknown>): Promise<CrmValidationResult>;
}

interface CrmValidationResult {
  found: boolean;
  status?: "approved" | "cancelled" | "pending" | "unknown";
  matchedField?: string;
  matchedValue?: string;
  rawResponse?: unknown;
}

interface SaleRecord {
  id: string;
  customer_phone: string | null;
  customer_company: string | null;
  adversus_external_id: string | null;
  adversus_opp_number: string | null;
}

// ============ GENERIC API ADAPTER ============
class GenericApiAdapter implements CrmAdapter {
  name = "generic_api";
  private apiUrl: string;
  private credentials: Record<string, string>;

  constructor(apiUrl: string, credentials: Record<string, string>) {
    this.apiUrl = apiUrl;
    this.credentials = credentials;
  }

  async validateSale(sale: SaleRecord, config: Record<string, unknown>): Promise<CrmValidationResult> {
    const searchField = (config.search_field as string) || "phone";
    const searchValue = searchField === "phone" ? sale.customer_phone : sale.adversus_external_id;

    if (!searchValue) {
      return { found: false };
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.credentials.api_key) {
        headers["Authorization"] = `Bearer ${this.credentials.api_key}`;
      } else if (this.credentials.username && this.credentials.password) {
        headers["Authorization"] = `Basic ${btoa(`${this.credentials.username}:${this.credentials.password}`)}`;
      }

      const url = `${this.apiUrl}?${searchField}=${encodeURIComponent(searchValue)}`;
      const response = await fetch(url, { method: "GET", headers });

      if (!response.ok) {
        console.log(`[GenericApiAdapter] API returned ${response.status}`);
        return { found: false };
      }

      const data = await response.json();
      const statusField = (config.status_field as string) || "status";
      const apiStatus = data[statusField] || "unknown";
      
      let status: CrmValidationResult["status"] = "unknown";
      if (["approved", "won", "closed_won", "active"].includes(apiStatus.toLowerCase())) {
        status = "approved";
      } else if (["cancelled", "canceled", "lost", "closed_lost", "annulleret"].includes(apiStatus.toLowerCase())) {
        status = "cancelled";
      } else if (["pending", "open", "new"].includes(apiStatus.toLowerCase())) {
        status = "pending";
      }
      
      return {
        found: true,
        status,
        matchedField: searchField,
        matchedValue: searchValue,
        rawResponse: data,
      };
    } catch (error) {
      console.error("[GenericApiAdapter] Error:", error);
      return { found: false };
    }
  }
}

// ============ HUBSPOT ADAPTER ============
class HubSpotAdapter implements CrmAdapter {
  name = "hubspot";
  private accessToken: string;

  constructor(credentials: Record<string, string>) {
    this.accessToken = credentials.access_token || credentials.api_key || "";
  }

  async validateSale(sale: SaleRecord, config: Record<string, unknown>): Promise<CrmValidationResult> {
    const searchField = (config.search_field as string) || "phone";
    const searchValue = searchField === "phone" ? sale.customer_phone : sale.adversus_external_id;

    if (!searchValue || !this.accessToken) {
      return { found: false };
    }

    try {
      const searchResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: searchField,
                  operator: "EQ",
                  value: searchValue,
                },
              ],
            },
          ],
          properties: ["firstname", "lastname", "email", "phone", "hs_lead_status"],
        }),
      });

      if (!searchResponse.ok) {
        console.log(`[HubSpotAdapter] Search returned ${searchResponse.status}`);
        return { found: false };
      }

      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return { found: false };
      }

      const contact = searchData.results[0];

      const dealsResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${contact.id}/associations/deals`,
        {
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
          },
        }
      );

      let dealStatus: CrmValidationResult["status"] = "pending";

      if (dealsResponse.ok) {
        const dealsData = await dealsResponse.json();
        if (dealsData.results && dealsData.results.length > 0) {
          const dealId = dealsData.results[0].id;
          
          const dealDetailResponse = await fetch(
            `https://api.hubapi.com/crm/v3/objects/deals/${dealId}?properties=dealstage,dealname`,
            {
              headers: {
                "Authorization": `Bearer ${this.accessToken}`,
              },
            }
          );

          if (dealDetailResponse.ok) {
            const dealDetail = await dealDetailResponse.json();
            const stage = dealDetail.properties?.dealstage || "";
            
            if (stage.includes("won") || stage.includes("closed")) {
              dealStatus = "approved";
            } else if (stage.includes("lost")) {
              dealStatus = "cancelled";
            }
          }
        }
      }

      return {
        found: true,
        status: dealStatus,
        matchedField: searchField,
        matchedValue: searchValue,
        rawResponse: contact,
      };
    } catch (error) {
      console.error("[HubSpotAdapter] Error:", error);
      return { found: false };
    }
  }
}

// ============ SALESFORCE ADAPTER ============
class SalesforceAdapter implements CrmAdapter {
  name = "salesforce";
  private accessToken: string;
  private instanceUrl: string;

  constructor(credentials: Record<string, string>) {
    this.accessToken = credentials.access_token || "";
    this.instanceUrl = credentials.instance_url || "";
  }

  async validateSale(sale: SaleRecord, config: Record<string, unknown>): Promise<CrmValidationResult> {
    const searchField = (config.search_field as string) || "Phone";
    const searchValue = searchField.toLowerCase() === "phone" ? sale.customer_phone : sale.adversus_external_id;

    if (!searchValue || !this.accessToken || !this.instanceUrl) {
      return { found: false };
    }

    try {
      const soqlQuery = `SELECT Id, Name, StageName FROM Opportunity WHERE Account.${searchField} = '${searchValue}' LIMIT 1`;
      const response = await fetch(
        `${this.instanceUrl}/services/data/v57.0/query?q=${encodeURIComponent(soqlQuery)}`,
        {
          headers: {
            "Authorization": `Bearer ${this.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        console.log(`[SalesforceAdapter] Query returned ${response.status}`);
        return { found: false };
      }

      const data = await response.json();

      if (!data.records || data.records.length === 0) {
        return { found: false };
      }

      const opportunity = data.records[0];
      const stage = opportunity.StageName?.toLowerCase() || "";
      
      let status: CrmValidationResult["status"] = "pending";
      if (stage.includes("won") || stage.includes("closed")) {
        status = "approved";
      } else if (stage.includes("lost")) {
        status = "cancelled";
      }
      
      return {
        found: true,
        status,
        matchedField: searchField,
        matchedValue: searchValue,
        rawResponse: opportunity,
      };
    } catch (error) {
      console.error("[SalesforceAdapter] Error:", error);
      return { found: false };
    }
  }
}

// ============ ADAPTER FACTORY ============
function createAdapter(
  crmType: string, 
  apiUrl: string | null, 
  credentials: Record<string, string>
): CrmAdapter {
  switch (crmType) {
    case "hubspot":
      return new HubSpotAdapter(credentials);
    case "salesforce":
      return new SalesforceAdapter(credentials);
    case "generic_api":
    default:
      return new GenericApiAdapter(apiUrl || "", credentials);
  }
}

// ============ MAIN HANDLER ============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let processedCount = 0;
  let approvedCount = 0;
  let cancelledCount = 0;
  let errorCount = 0;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { client_id } = body;

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "Missing client_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[customer-crm-syncer] Starting sync for client: ${client_id}`);

    const { data: integration, error: integrationError } = await supabase.rpc(
      "get_customer_integration_decrypted",
      {
        p_client_id: client_id,
        p_encryption_key: encryptionKey,
      }
    );

    if (integrationError || !integration || integration.length === 0) {
      console.error("[customer-crm-syncer] Integration not found:", integrationError);
      return new Response(
        JSON.stringify({ error: "Integration not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = integration[0];
    const credentials = config.credentials || {};
    const mappingConfig = config.config || {};

    console.log(`[customer-crm-syncer] Using CRM type: ${config.crm_type}`);

    const adapter = createAdapter(config.crm_type, config.api_url, credentials);

    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select(`
        id,
        customer_phone,
        customer_company,
        adversus_external_id,
        adversus_opp_number,
        agent_name,
        sale_datetime
      `)
      .eq("client_campaign_id", client_id)
      .gte("sale_datetime", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order("sale_datetime", { ascending: false })
      .limit(200);

    if (salesError) {
      console.error("[customer-crm-syncer] Error fetching sales:", salesError);
      throw salesError;
    }

    console.log(`[customer-crm-syncer] Found ${sales?.length || 0} sales to validate`);

    const results: Array<{ saleId: string; status: string; matchedField?: string }> = [];

    for (const sale of sales || []) {
      processedCount++;
      
      try {
        const result = await adapter.validateSale(sale as SaleRecord, mappingConfig);

        if (result.found && result.status) {
          if (result.status === "approved") {
            approvedCount++;
          } else if (result.status === "cancelled") {
            cancelledCount++;
          }
          
          results.push({ 
            saleId: sale.id, 
            status: result.status,
            matchedField: result.matchedField 
          });
          
          console.log(`[customer-crm-syncer] Sale ${sale.id} (${sale.adversus_external_id}): ${result.status}`);
        }
      } catch (err) {
        errorCount++;
        console.error(`[customer-crm-syncer] Error validating sale ${sale.id}:`, err);
      }

      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const duration = Date.now() - startTime;
    const status = errorCount === 0 ? "success" : errorCount === processedCount ? "failed" : "partial";

    const { error: updateError } = await supabase
      .from("customer_integrations")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: status,
      })
      .eq("client_id", client_id);

    if (updateError) {
      console.error("[customer-crm-syncer] Error updating status:", updateError);
    }

    console.log(`[customer-crm-syncer] Completed in ${duration}ms. Processed: ${processedCount}, Approved: ${approvedCount}, Cancelled: ${cancelledCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        approved: approvedCount,
        cancelled: cancelledCount,
        errors: errorCount,
        duration_ms: duration,
        status,
        results: results.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[customer-crm-syncer] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
