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
  agent_name: string | null;
  client_campaign_id: string | null;
  validation_status: string | null;
}

interface SaleItemRecord {
  id: string;
  sale_id: string;
  mapped_commission: number | null;
  quantity: number | null;
}

// ============ STATUS MAPPING HELPER ============
const DEFAULT_APPROVED_STATUSES = ["approved", "won", "closed_won", "closedwon", "active", "signed", "closed"];
const DEFAULT_CANCELLED_STATUSES = ["cancelled", "canceled", "lost", "closed_lost", "closedlost", "annulleret", "churn", "rejected"];
const DEFAULT_PENDING_STATUSES = ["pending", "open", "new", "in_progress"];

function mapStatusFromConfig(
  rawStatus: string,
  config: Record<string, unknown>
): CrmValidationResult["status"] {
  const normalized = rawStatus.toLowerCase().trim();
  
  // Get config arrays or use defaults
  const approvedStatuses = (config.approved_statuses as string[]) || DEFAULT_APPROVED_STATUSES;
  const cancelledStatuses = (config.cancelled_statuses as string[]) || DEFAULT_CANCELLED_STATUSES;
  const pendingStatuses = (config.pending_statuses as string[]) || DEFAULT_PENDING_STATUSES;
  
  // Normalize all config statuses for comparison
  const normalizedApproved = approvedStatuses.map(s => s.toLowerCase().trim());
  const normalizedCancelled = cancelledStatuses.map(s => s.toLowerCase().trim());
  const normalizedPending = pendingStatuses.map(s => s.toLowerCase().trim());
  
  if (normalizedApproved.includes(normalized)) {
    return "approved";
  } else if (normalizedCancelled.includes(normalized)) {
    return "cancelled";
  } else if (normalizedPending.includes(normalized)) {
    return "pending";
  }
  
  return "unknown";
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
      
      const status = mapStatusFromConfig(apiStatus, config);
      
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
            
            // Use dynamic status mapping from config
            dealStatus = mapStatusFromConfig(stage, config);
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
      const stage = opportunity.StageName || "";
      
      // Use dynamic status mapping from config
      const status = mapStatusFromConfig(stage, config);
      
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

// ============ CLAWBACK HANDLER ============
async function createClawbackTransaction(
  supabase: any,
  sale: SaleRecord,
  saleItems: SaleItemRecord[],
  clientId: string,
  source: string
): Promise<number> {
  const agentName = sale.agent_name || "Ukendt";
  let totalClawback = 0;

  for (const item of saleItems) {
    const qty = Number(item.quantity ?? 1) || 1;
    const commission = Number(item.mapped_commission) || 0;
    const lineCommission = qty * commission;
    
    if (lineCommission > 0) {
      totalClawback += lineCommission;
    }
  }

  if (totalClawback > 0) {
    // Check if clawback already exists for this sale
    const { data: existingClawback } = await supabase
      .from("commission_transactions")
      .select("id")
      .eq("sale_id", sale.id)
      .eq("transaction_type", "clawback")
      .limit(1)
      .maybeSingle();

    if (existingClawback) {
      console.log(`[customer-crm-syncer] Clawback already exists for sale ${sale.id}, skipping`);
      return 0;
    }

    const { error } = await supabase
      .from("commission_transactions")
      .insert({
        sale_id: sale.id,
        agent_name: agentName,
        client_id: clientId,
        transaction_type: "clawback",
        amount: -totalClawback,
        reason: `Sale cancelled/rejected by CRM validation`,
        source: source,
        source_reference: sale.adversus_external_id || sale.id,
      });

    if (error) {
      console.error(`[customer-crm-syncer] Error creating clawback:`, error);
    } else {
      console.log(`[customer-crm-syncer] Created clawback of ${totalClawback} DKK for sale ${sale.id}`);
    }
  }

  return totalClawback;
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
  let unmatchedCount = 0;
  let rejectedCount = 0;
  let errorCount = 0;
  let clawbackTotal = 0;
  let newClawbacks = 0;

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

    // Fetch sales with validation_status to check for already processed ones
    const { data: sales, error: salesError } = await supabase
      .from("sales")
      .select(`
        id,
        customer_phone,
        customer_company,
        adversus_external_id,
        adversus_opp_number,
        agent_name,
        client_campaign_id,
        validation_status,
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

    const results: Array<{ saleId: string; status: string; matchedField?: string; clawback?: number }> = [];

    for (const sale of (sales || []) as SaleRecord[]) {
      processedCount++;
      
      try {
        const result = await adapter.validateSale(sale, mappingConfig);
        const previousStatus = sale.validation_status;
        let newStatus = previousStatus;

        if (result.found && result.status) {
          newStatus = result.status;
          
          if (result.status === "approved") {
            approvedCount++;
          } else if (result.status === "cancelled") {
            cancelledCount++;
          }

          // Update sale validation_status
          if (previousStatus !== result.status) {
            await supabase
              .from("sales")
              .update({ validation_status: result.status })
              .eq("id", sale.id);

            // Create clawback if status changed to cancelled/rejected and wasn't before
            if ((result.status === "cancelled" || result.status === "unknown") && 
                previousStatus !== "cancelled" && previousStatus !== "rejected") {
              
              // Fetch sale items for commission calculation
              const { data: saleItems } = await supabase
                .from("sale_items")
                .select("id, sale_id, mapped_commission, quantity")
                .eq("sale_id", sale.id);

              if (saleItems && saleItems.length > 0) {
                // Get client_id from client_campaigns
                const { data: campaign } = await supabase
                  .from("client_campaigns")
                  .select("client_id")
                  .eq("id", sale.client_campaign_id)
                  .single();

                if (campaign?.client_id) {
                  const clawbackAmount = await createClawbackTransaction(
                    supabase,
                    sale,
                    saleItems as SaleItemRecord[],
                    campaign.client_id,
                    "crm_sync"
                  );
                  
                  if (clawbackAmount > 0) {
                    clawbackTotal += clawbackAmount;
                    newClawbacks++;
                  }
                }
              }
            }
          }
          
          results.push({ 
            saleId: sale.id, 
            status: result.status,
            matchedField: result.matchedField,
            clawback: result.status === "cancelled" ? clawbackTotal : undefined
          });
          
          console.log(`[customer-crm-syncer] Sale ${sale.id} (${sale.adversus_external_id}): ${result.status}`);
        } else {
          // Sale not found in CRM
          unmatchedCount++;
          
          if (previousStatus !== "pending") {
            await supabase
              .from("sales")
              .update({ validation_status: "pending" })
              .eq("id", sale.id);
          }
        }
      } catch (err) {
        errorCount++;
        console.error(`[customer-crm-syncer] Error validating sale ${sale.id}:`, err);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const duration = Date.now() - startTime;
    
    // Build detailed status message
    const statusParts: string[] = [];
    statusParts.push(`Processed ${processedCount} sales`);
    if (approvedCount > 0) statusParts.push(`${approvedCount} approved`);
    if (cancelledCount > 0) statusParts.push(`${cancelledCount} cancelled`);
    if (unmatchedCount > 0) statusParts.push(`${unmatchedCount} not found in CRM`);
    if (newClawbacks > 0) statusParts.push(`${newClawbacks} clawbacks (${clawbackTotal.toLocaleString("da-DK")} DKK)`);
    if (errorCount > 0) statusParts.push(`${errorCount} errors`);

    const detailedStatus = errorCount === 0 
      ? `Success: ${statusParts.join(", ")}`
      : errorCount === processedCount 
        ? `Failed: ${statusParts.join(", ")}`
        : `Partial: ${statusParts.join(", ")}`;

    // Update integration status with detailed message
    const { error: updateError } = await supabase
      .from("customer_integrations")
      .update({
        last_run_at: new Date().toISOString(),
        last_status: detailedStatus,
      })
      .eq("client_id", client_id);

    if (updateError) {
      console.error("[customer-crm-syncer] Error updating status:", updateError);
    }

    // Log to integration_logs
    const logStatus = errorCount === 0 ? "success" : errorCount === processedCount ? "error" : "warning";
    await supabase.from("integration_logs").insert({
      integration_type: "crm",
      integration_id: config.id,
      integration_name: `CRM Sync (${config.crm_type})`,
      status: logStatus,
      message: detailedStatus,
      details: {
        client_id,
        crm_type: config.crm_type,
        processed: processedCount,
        approved: approvedCount,
        cancelled: cancelledCount,
        unmatched: unmatchedCount,
        errors: errorCount,
        clawbacks: { count: newClawbacks, total: clawbackTotal },
        duration_ms: duration,
      },
    });

    console.log(`[customer-crm-syncer] ${detailedStatus} in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        approved: approvedCount,
        cancelled: cancelledCount,
        unmatched: unmatchedCount,
        errors: errorCount,
        clawbacks: {
          count: newClawbacks,
          total: clawbackTotal,
        },
        duration_ms: duration,
        status: detailedStatus,
        results: results.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[customer-crm-syncer] Error:", message);

    // Log critical error
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    await supabase.from("integration_logs").insert({
      integration_type: "crm",
      integration_id: null,
      integration_name: "CRM Sync",
      status: "error",
      message: `Critical error: ${message}`,
      details: { error: message },
    });

    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});