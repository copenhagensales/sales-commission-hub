import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";

interface EnreachCredentials {
  username?: string;
  password?: string;
  api_token?: string;
  api_url?: string; // Full base URL like https://wshero01.herobase.com/api
}

// HeroBase API response types
interface HeroBaseCampaign {
  uniqueId: string;
  name: string;
  active?: boolean;
  status?: string;
}

interface HeroBaseLead {
  uniqueId: string;
  soldTime?: string;
  createdTime?: string;
  updatedTime?: string;
  status?: string;
  agent?: {
    uniqueId?: string;
    name?: string;
    email?: string;
  };
  user?: {
    uniqueId?: string;
    name?: string;
    email?: string;
  };
  campaign?: {
    uniqueId?: string;
    name?: string;
  };
  data?: Record<string, unknown>;
  customFields?: Record<string, unknown>;
  company?: string;
  name?: string;
  phone?: string;
  products?: Array<{
    uniqueId?: string;
    name?: string;
    quantity?: number;
    price?: number;
  }>;
}

export class EnreachAdapter implements DialerAdapter {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(credentials: EnreachCredentials) {
    // Default to wshero01.herobase.com/api if not provided
    const providedUrl = credentials.api_url || "https://wshero01.herobase.com/api";
    // Ensure no trailing slash
    this.baseUrl = providedUrl.endsWith('/') ? providedUrl.slice(0, -1) : providedUrl;
    // Ensure /api suffix
    if (!this.baseUrl.endsWith('/api')) {
      this.baseUrl = this.baseUrl + '/api';
    }
    
    console.log(`[EnreachAdapter] Base URL: ${this.baseUrl}`);
    
    // Determine auth method: Basic (username/password) or Bearer (api_token)
    let authHeader: string;
    if (credentials.username && credentials.password) {
      const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
      authHeader = `Basic ${basicAuth}`;
      console.log(`[EnreachAdapter] Using Basic Authentication for user: ${credentials.username}`);
    } else if (credentials.api_token) {
      authHeader = `Bearer ${credentials.api_token}`;
      console.log("[EnreachAdapter] Using Bearer Token Authentication");
    } else {
      throw new Error("[EnreachAdapter] No valid credentials provided. Require username/password or api_token.");
    }

    this.headers = {
      "Authorization": authHeader,
      "Content-Type": "application/json; charset=utf-8",
      "Accept": "application/json",
    };
  }

  private async get(endpoint: string): Promise<unknown> {
    // Endpoint already includes leading slash, e.g., /campaigns
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[EnreachAdapter] GET ${url}`);
    
    const response = await fetch(url, {
      method: "GET",
      headers: this.headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EnreachAdapter] API Error ${response.status}: ${errorText.substring(0, 300)}`);
      throw new Error(`Enreach API error: ${response.status} - ${errorText.substring(0, 300)}`);
    }

    return response.json();
  }

  async fetchUsers(): Promise<StandardUser[]> {
    try {
      // HeroBase returns array directly
      const data = await this.get("/users") as Array<{
        uniqueId: string;
        name?: string;
        email?: string;
        active?: boolean;
      }> | { users?: Array<{ uniqueId: string; name?: string; email?: string; active?: boolean }> };

      const users = Array.isArray(data) ? data : (data.users || []);
      
      return users.map((user) => ({
        externalId: user.uniqueId || String(user.uniqueId),
        name: user.name || "Unknown",
        email: user.email || "",
        isActive: user.active ?? true,
        metadata: { source: "enreach" },
      }));
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching users:", error);
      return [];
    }
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    try {
      // HeroBase uses /campaigns endpoint and returns array directly
      const data = await this.get("/campaigns") as HeroBaseCampaign[] | { campaigns?: HeroBaseCampaign[] };

      const campaigns = Array.isArray(data) ? data : (data.campaigns || []);
      console.log(`[EnreachAdapter] Fetched ${campaigns.length} campaigns`);
      
      return campaigns.map((campaign) => ({
        externalId: campaign.uniqueId,
        name: campaign.name || "Unknown Campaign",
        isActive: campaign.active ?? (campaign.status === "active"),
      }));
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching campaigns:", error);
      return [];
    }
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      console.log(`[EnreachAdapter] Fetching sales for last ${days} days`);

      // HeroBase uses /leads endpoint with query params
      // Use createdTime for sorting (safer than soldTime which may be null)
      let data: HeroBaseLead[] | { leads?: HeroBaseLead[] };
      
      try {
        // Primary attempt: order by createdTime
        console.log("[EnreachAdapter] Attempting fetch with orderBy=createdTime");
        data = await this.get(`/leads?take=100&orderBy=createdTime&descending=true`) as 
          HeroBaseLead[] | { leads?: HeroBaseLead[] };
      } catch (primaryError) {
        console.warn("[EnreachAdapter] Primary fetch failed, trying fallback without sorting:", primaryError);
        // Fallback: just get leads without sorting
        data = await this.get(`/leads?take=50`) as 
          HeroBaseLead[] | { leads?: HeroBaseLead[] };
      }

      const allLeads = Array.isArray(data) ? data : (data.leads || []);
      console.log(`[EnreachAdapter] Fetched ${allLeads.length} total leads`);

      // Filter to only sold leads (status = "Solgt" or similar)
      const soldStatuses = ["solgt", "sold", "success", "won", "closed won"];
      const results = allLeads.filter((lead) => {
        const status = (lead.status || "").toLowerCase();
        return soldStatuses.includes(status);
      });
      
      console.log(`[EnreachAdapter] Filtered to ${results.length} sold leads`);

      // Filter by date range
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const filteredResults = results.filter((lead) => {
        const saleDate = lead.soldTime || lead.createdTime || lead.updatedTime;
        if (!saleDate) return false;
        return new Date(saleDate) >= cutoffDate;
      });
      
      console.log(`[EnreachAdapter] After date filter: ${filteredResults.length} leads in last ${days} days`);

      // Build campaign mapping lookup by external campaign ID
      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
        console.log(`[EnreachAdapter] Loaded ${campaignMappings.length} campaign mappings`);
      }

      return filteredResults.map((lead) => {
        const agent = lead.agent || lead.user;
        const campaignId = lead.campaign?.uniqueId || "";
        
        // Get mapping config for this campaign
        const mapping = mappingLookup.get(campaignId);
        
        // Extract external reference (OPP) from customFields or data
        const variables = { ...lead.data, ...lead.customFields };
        let externalReference: string | null = null;
        
        if (mapping?.referenceConfig) {
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
        const products: StandardProduct[] = (lead.products || []).map((p) => ({
          name: p.name || "Unknown Product",
          externalId: p.uniqueId || "unknown",
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
          externalId: lead.uniqueId,
          sourceSystem: "enreach" as const,
          saleDate: lead.soldTime || lead.createdTime || new Date().toISOString(),
          agentEmail: agent?.email || "",
          agentExternalId: agent?.uniqueId,
          agentName: agent?.name,
          customerName: lead.company || lead.name,
          customerPhone: lead.phone,
          campaignId,
          externalReference,
          clientCampaignId: mapping?.clientCampaignId || null,
          products,
          metadata: {
            source: "enreach",
            campaignName: lead.campaign?.name,
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
   * Fallback search for OPP-like values in lead data/customFields
   */
  private searchForOppInVariables(variables: Record<string, unknown>): string | null {
    const commonFields = [
      "opp", "OPP", "opp_number", "order_id", "order_number",
      "reference", "ref", "external_ref", "orderId", "orderNumber",
      "ordreId", "ordrenummer", "OpportunityId"
    ];

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
   * Fetch detailed lead data for enrichment
   */
  async fetchResultData(resultId: string): Promise<Record<string, unknown>> {
    try {
      const data = await this.get(`/leads/${resultId}`) as HeroBaseLead;

      return {
        ...data.data,
        ...data.customFields,
      };
    } catch (error) {
      console.error(`[EnreachAdapter] Error fetching lead data for ${resultId}:`, error);
      return {};
    }
  }
}
