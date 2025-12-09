import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";

interface EnreachCredentials {
  username?: string;
  password?: string;
  api_token?: string; // Fallback for Bearer token auth
  api_url?: string;
}

export class EnreachAdapter implements DialerAdapter {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(credentials: EnreachCredentials) {
    this.baseUrl = credentials.api_url || "https://hero01.herobase.com/api/v1";
    
    // Determine auth method: Basic (username/password) or Bearer (api_token)
    let authHeader: string;
    if (credentials.username && credentials.password) {
      // Basic Authentication
      const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
      authHeader = `Basic ${basicAuth}`;
      console.log("[EnreachAdapter] Using Basic Authentication");
    } else if (credentials.api_token) {
      // Fallback to Bearer token
      authHeader = `Bearer ${credentials.api_token}`;
      console.log("[EnreachAdapter] Using Bearer Token Authentication");
    } else {
      throw new Error("[EnreachAdapter] No valid credentials provided. Require username/password or api_token.");
    }

    this.headers = {
      "Authorization": authHeader,
      "Content-Type": "application/json",
    };
  }

  private async get(endpoint: string): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[EnreachAdapter] GET ${url}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Enreach API error: ${response.status} - ${errorText}`);
    }

    return response.json();
  }

  async fetchUsers(): Promise<StandardUser[]> {
    try {
      const data = await this.get("/users") as { users?: Array<{
        id: string;
        name: string;
        email: string;
        active?: boolean;
        status?: string;
      }> };

      const users = data.users || [];
      
      return users.map((user) => ({
        externalId: String(user.id),
        name: user.name || "Unknown",
        email: user.email || "",
        isActive: user.active ?? user.status === "active",
        metadata: { source: "enreach" },
      }));
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching users:", error);
      return [];
    }
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    try {
      // Enreach typically calls these "flows" or "queues"
      const data = await this.get("/flows") as { flows?: Array<{
        id: string;
        name: string;
        active?: boolean;
        status?: string;
      }> };

      const flows = data.flows || [];
      
      return flows.map((flow) => ({
        externalId: String(flow.id),
        name: flow.name || "Unknown Flow",
        isActive: flow.active ?? flow.status === "active",
      }));
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching campaigns:", error);
      return [];
    }
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      console.log(`[EnreachAdapter] Fetching sales from ${startStr} to ${endStr}`);

      // Enreach typically uses /calls or /results endpoint for completed calls/sales
      const data = await this.get(`/results?from=${startStr}&to=${endStr}&status=sale`) as {
        results?: Array<{
          id: string;
          external_id?: string;
          created_at?: string;
          timestamp?: string;
          agent?: {
            id: string;
            name: string;
            email: string;
          };
          user?: {
            id: string;
            name: string;
            email: string;
          };
          contact?: {
            name?: string;
            company?: string;
            phone?: string;
          };
          lead?: {
            name?: string;
            company?: string;
            phone?: string;
          };
          flow_id?: string;
          campaign_id?: string;
          variables?: Record<string, unknown>;
          call_variables?: Record<string, unknown>;
          products?: Array<{
            id: string;
            external_id?: string;
            name: string;
            quantity?: number;
            price?: number;
          }>;
        }>;
      };

      const results = data.results || [];
      console.log(`[EnreachAdapter] Fetched ${results.length} sales`);

      // Build campaign mapping lookup by external campaign ID
      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
        console.log(`[EnreachAdapter] Loaded ${campaignMappings.length} campaign mappings`);
      }

      return results.map((result) => {
        const agent = result.agent || result.user;
        const contact = result.contact || result.lead;
        const campaignId = result.flow_id || result.campaign_id || "";
        
        // Get mapping config for this campaign
        const mapping = mappingLookup.get(campaignId);
        
        // Extract external reference (OPP) from call variables
        const variables = result.variables || result.call_variables || {};
        let externalReference: string | null = null;
        
        if (mapping?.referenceConfig) {
          // Use configured extraction method
          externalReference = this.extractReference(variables, mapping.referenceConfig);
          if (externalReference) {
            console.log(`[EnreachAdapter] Extracted reference via config: ${externalReference}`);
          }
        } 
        
        if (!externalReference) {
          // Fallback: search for common OPP field patterns
          externalReference = this.searchForOppInVariables(variables);
        }

        // Map products
        const products: StandardProduct[] = (result.products || []).map((p) => ({
          name: p.name,
          externalId: p.external_id || p.id,
          quantity: p.quantity || 1,
          unitPrice: p.price || 0,
        }));

        // If no products, create a placeholder
        if (products.length === 0) {
          products.push({
            name: "Unknown Product",
            externalId: "unknown",
            quantity: 1,
            unitPrice: 0,
          });
        }

        return {
          externalId: result.external_id || result.id,
          sourceSystem: "enreach" as const,
          saleDate: result.created_at || result.timestamp || new Date().toISOString(),
          agentEmail: agent?.email || "",
          agentExternalId: agent?.id ? String(agent.id) : undefined,
          agentName: agent?.name,
          customerName: contact?.company || contact?.name,
          customerPhone: contact?.phone,
          campaignId,
          externalReference,
          clientCampaignId: mapping?.clientCampaignId || null,
          products,
          metadata: {
            source: "enreach",
            variables,
          },
        };
      });
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching sales:", error);
      return [];
    }
  }

  /**
   * Extract reference using configured extraction method
   */
  private extractReference(
    variables: Record<string, unknown>,
    config: ReferenceExtractionConfig
  ): string | null {
    try {
      switch (config.type) {
        case "field_id": {
          const value = variables[config.value];
          return value ? String(value) : null;
        }
        case "json_path": {
          // Simple dot-notation path resolution
          const parts = config.value.split(".");
          let current: unknown = variables;
          for (const part of parts) {
            if (current && typeof current === "object" && part in current) {
              current = (current as Record<string, unknown>)[part];
            } else {
              return null;
            }
          }
          return current ? String(current) : null;
        }
        case "regex": {
          // Search all string values for regex match
          const regex = new RegExp(config.value);
          for (const value of Object.values(variables)) {
            if (typeof value === "string") {
              const match = value.match(regex);
              if (match) return match[0];
            }
          }
          return null;
        }
        case "static":
          return config.value;
        default:
          return null;
      }
    } catch (error) {
      console.error("[EnreachAdapter] Error extracting reference:", error);
      return null;
    }
  }

  /**
   * Fallback search for OPP-like values in call variables
   */
  private searchForOppInVariables(variables: Record<string, unknown>): string | null {
    // Common field names for order/reference numbers in Enreach
    const commonFields = [
      "opp", "OPP", "opp_number", "order_id", "order_number",
      "reference", "ref", "external_ref", "orderId", "orderNumber"
    ];

    // Check common field names first
    for (const field of commonFields) {
      if (variables[field]) {
        return String(variables[field]);
      }
    }

    // Search for OPP pattern in all string values
    const oppPattern = /OPP-?\d{5,}/i;
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === "string") {
        const match = value.match(oppPattern);
        if (match) {
          console.log(`[EnreachAdapter] Found OPP in field ${key}: ${match[0]}`);
          return match[0];
        }
      }
    }

    return null;
  }

  /**
   * Fetch detailed call/result data for enrichment (similar to Adversus lead data)
   */
  async fetchResultData(resultId: string): Promise<Record<string, unknown>> {
    try {
      const data = await this.get(`/results/${resultId}`) as {
        variables?: Record<string, unknown>;
        call_variables?: Record<string, unknown>;
        custom_fields?: Record<string, unknown>;
      };

      return {
        ...data.variables,
        ...data.call_variables,
        ...data.custom_fields,
      };
    } catch (error) {
      console.error(`[EnreachAdapter] Error fetching result data for ${resultId}:`, error);
      return {};
    }
  }
}
