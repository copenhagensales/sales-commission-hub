import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";

interface EnreachCredentials {
  username?: string;
  password?: string;
  api_token?: string;
  api_url?: string; // Full base URL like https://wshero01.herobase.com/api
}

// HeroBase API response types (flexible for different casing)
interface HeroBaseCampaign {
  uniqueId?: string;
  UniqueId?: string;
  Id?: string;
  name?: string;
  Name?: string;
  active?: boolean;
  Active?: boolean;
  status?: string;
  Status?: string;
}

interface HeroBaseLead {
  [key: string]: unknown; // Allow any key for flexible lookup
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

  /**
   * Case-insensitive value lookup - tries multiple key variations
   */
  private getValue(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
    if (!obj || typeof obj !== 'object') return null;
    
    for (const key of keys) {
      // Direct match
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        return obj[key];
      }
      // Try lowercase
      const lowerKey = key.toLowerCase();
      for (const objKey of Object.keys(obj)) {
        if (objKey.toLowerCase() === lowerKey && obj[objKey] !== undefined && obj[objKey] !== null && obj[objKey] !== '') {
          return obj[objKey];
        }
      }
    }
    return null;
  }

  /**
   * Get string value with fallback
   */
  private getStr(obj: Record<string, unknown> | null | undefined, keys: string[], fallback = ""): string {
    const val = this.getValue(obj, keys);
    if (val === null || val === undefined) return fallback;
    return String(val);
  }

  /**
   * Get nested object value (e.g., agent.email)
   */
  private getNestedStr(obj: Record<string, unknown> | null | undefined, path: string, fallback = ""): string {
    if (!obj) return fallback;
    
    const parts = path.split('.');
    let current: unknown = obj;
    
    for (const part of parts) {
      if (current && typeof current === 'object') {
        // Try multiple casing variations for each part
        const found = this.getValue(current as Record<string, unknown>, [part, part.toLowerCase(), part.charAt(0).toUpperCase() + part.slice(1)]);
        if (found !== null) {
          current = found;
        } else {
          return fallback;
        }
      } else {
        return fallback;
      }
    }
    
    return current ? String(current) : fallback;
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
      console.error(`[EnreachAdapter] API Error ${response.status}: ${errorText.substring(0, 500)}`);
      throw new Error(`Enreach API error: ${response.status} - ${errorText.substring(0, 300)}`);
    }

    return response.json();
  }

  async fetchUsers(): Promise<StandardUser[]> {
    try {
      // HeroBase returns array directly
      const data = await this.get("/users") as unknown[];

      const users = Array.isArray(data) ? data : ((data as Record<string, unknown>).users as unknown[] || []);
      
      return users.map((user) => {
        const u = user as Record<string, unknown>;
        return {
          externalId: this.getStr(u, ['uniqueId', 'UniqueId', 'Id', 'id']),
          name: this.getStr(u, ['name', 'Name', 'FullName', 'fullName'], "Unknown"),
          email: this.getStr(u, ['email', 'Email', 'EmailAddress', 'emailAddress']),
          isActive: Boolean(this.getValue(u, ['active', 'Active', 'IsActive', 'isActive']) ?? true),
          metadata: { source: "enreach" },
        };
      });
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching users:", error);
      return [];
    }
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    try {
      // HeroBase uses /campaigns endpoint and returns array directly
      const data = await this.get("/campaigns") as unknown;

      const campaigns = Array.isArray(data) ? data : ((data as Record<string, unknown>).campaigns as unknown[] || []);
      console.log(`[EnreachAdapter] Fetched ${campaigns.length} campaigns`);
      
      return campaigns.map((campaign) => {
        const c = campaign as HeroBaseCampaign;
        const id = this.getStr(c as Record<string, unknown>, ['uniqueId', 'UniqueId', 'Id', 'id']);
        const name = this.getStr(c as Record<string, unknown>, ['name', 'Name'], "Unknown Campaign");
        const active = this.getValue(c as Record<string, unknown>, ['active', 'Active', 'isActive', 'IsActive']);
        const status = this.getStr(c as Record<string, unknown>, ['status', 'Status']);
        
        return {
          externalId: id,
          name,
          isActive: active !== null ? Boolean(active) : (status?.toLowerCase() === "active"),
        };
      });
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching campaigns:", error);
      return [];
    }
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      console.log(`[EnreachAdapter] Fetching sales for last ${days} days`);

      // HeroBase uses /simpleleads endpoint for exporting leads
      // Format: /simpleleads?Projects=*&ModifiedFrom=YYYY-MM-DD&Statuses=UserProcessed&LeadClosures=Success
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const modifiedFrom = cutoffDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      let allLeads: HeroBaseLead[] = [];
      
      try {
        // Primary attempt: fetch successful/sold leads
        const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&Statuses=UserProcessed&LeadClosures=Success`;
        console.log(`[EnreachAdapter] Fetching from: ${endpoint}`);
        const data = await this.get(endpoint) as unknown;
        
        if (Array.isArray(data)) {
          allLeads = data as HeroBaseLead[];
        } else if (data && typeof data === 'object') {
          // Try common response wrapper keys
          const wrapper = data as Record<string, unknown>;
          allLeads = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || wrapper.Data || wrapper.data || []) as HeroBaseLead[];
        }
      } catch (primaryError) {
        console.warn("[EnreachAdapter] Primary fetch failed, trying alternative endpoint:", primaryError);
        try {
          // Fallback: try just with Projects=* and ModifiedFrom
          const fallbackEndpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}`;
          console.log(`[EnreachAdapter] Fallback fetch from: ${fallbackEndpoint}`);
          const data = await this.get(fallbackEndpoint) as unknown;
          
          if (Array.isArray(data)) {
            allLeads = data as HeroBaseLead[];
          } else if (data && typeof data === 'object') {
            const wrapper = data as Record<string, unknown>;
            allLeads = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || wrapper.Data || wrapper.data || []) as HeroBaseLead[];
          }
        } catch (fallbackError) {
          console.error("[EnreachAdapter] Fallback also failed:", fallbackError);
          return [];
        }
      }

      console.log(`[EnreachAdapter] Fetched ${allLeads.length} total leads`);
      
      // Log first lead structure for debugging
      if (allLeads.length > 0) {
        console.log(`[EnreachAdapter] Sample lead keys: ${Object.keys(allLeads[0]).slice(0, 15).join(', ')}`);
        console.log(`[EnreachAdapter] Sample lead (first 500 chars): ${JSON.stringify(allLeads[0]).substring(0, 500)}`);
      }

      // Build campaign mapping lookup by external campaign ID
      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
        console.log(`[EnreachAdapter] Loaded ${campaignMappings.length} campaign mappings`);
      }

      const sales = allLeads.map((lead: HeroBaseLead) => {
        // Extract external ID with multiple key variations
        const externalId = this.getStr(lead, [
          'uniqueId', 'UniqueId', 'LeadUniqueId', 'leadUniqueId',
          'Id', 'id', 'LeadId', 'leadId', 'ExternalId', 'externalId'
        ]);

        // Extract agent info - try nested objects first, then flat keys
        const agentObj = (lead.Agent || lead.agent || lead.User || lead.user || {}) as Record<string, unknown>;
        const agentEmail = this.getStr(agentObj, ['email', 'Email', 'EmailAddress']) ||
                          this.getStr(lead, ['AgentEmail', 'agentEmail', 'UserEmail', 'userEmail', 'Agent.Email']);
        const agentName = this.getStr(agentObj, ['name', 'Name', 'FullName']) ||
                         this.getStr(lead, ['AgentName', 'agentName', 'UserName', 'userName', 'Agent.Name']);
        const agentId = this.getStr(agentObj, ['uniqueId', 'UniqueId', 'Id', 'id']) ||
                       this.getStr(lead, ['AgentId', 'agentId', 'UserId', 'userId']);

        // Extract campaign info
        const campaignObj = (lead.Campaign || lead.campaign || lead.Project || lead.project || {}) as Record<string, unknown>;
        const campaignId = this.getStr(campaignObj, ['uniqueId', 'UniqueId', 'Id', 'id']) ||
                          this.getStr(lead, ['CampaignId', 'campaignId', 'ProjectId', 'projectId', 'CampaignUniqueId']);
        const campaignName = this.getStr(campaignObj, ['name', 'Name']) ||
                            this.getStr(lead, ['CampaignName', 'campaignName', 'ProjectName', 'projectName', 'FlowName', 'flowName']);

        // Extract customer info
        const customerName = this.getStr(lead, [
          'company', 'Company', 'CompanyName', 'companyName',
          'name', 'Name', 'CustomerName', 'customerName', 'LeadName', 'leadName'
        ]);
        const customerPhone = this.getStr(lead, [
          'phone', 'Phone', 'PhoneNumber', 'phoneNumber',
          'Telephone', 'telephone', 'Mobile', 'mobile', 'CellPhone', 'cellPhone'
        ]);

        // Extract sale date
        const saleDate = this.getStr(lead, [
          'soldTime', 'SoldTime', 'SoldDate', 'soldDate',
          'closedTime', 'ClosedTime', 'ClosedDate', 'closedDate',
          'modifiedTime', 'ModifiedTime', 'updatedTime', 'UpdatedTime',
          'createdTime', 'CreatedTime', 'created', 'Created', 'CreatedDate', 'createdDate'
        ]) || new Date().toISOString();

        // Get mapping config for this campaign
        const mapping = mappingLookup.get(campaignId);
        
        // Extract external reference (OPP) from customFields or data
        const dataObj = (lead.data || lead.Data || lead.customFields || lead.CustomFields || {}) as Record<string, unknown>;
        const variables = { ...dataObj, ...lead };
        let externalReference: string | null = null;
        
        if (mapping?.referenceConfig) {
          externalReference = this.extractReference(variables as Record<string, unknown>, mapping.referenceConfig);
          if (externalReference) {
            console.log(`[EnreachAdapter] Extracted reference via config: ${externalReference}`);
          }
        } 
        
        if (!externalReference) {
          // Fallback: search for common OPP field patterns
          externalReference = this.searchForOppInVariables(variables as Record<string, unknown>);
        }

        // Map products - try multiple structures
        const productsArray = (lead.Products || lead.products || lead.Items || lead.items || []) as unknown[];
        let products: StandardProduct[] = [];
        
        if (Array.isArray(productsArray) && productsArray.length > 0) {
          products = productsArray.map((p) => {
            const prod = p as Record<string, unknown>;
            return {
              name: this.getStr(prod, ['name', 'Name', 'ProductName', 'productName', 'Title', 'title'], "Unknown Product"),
              externalId: this.getStr(prod, ['uniqueId', 'UniqueId', 'Id', 'id', 'ProductId', 'productId'], "unknown"),
              quantity: Number(this.getValue(prod, ['quantity', 'Quantity', 'Qty', 'qty']) || 1),
              unitPrice: Number(this.getValue(prod, ['price', 'Price', 'UnitPrice', 'unitPrice', 'Amount', 'amount']) || 0),
            };
          });
        }

        // If no products found, use campaign/flow name as product
        if (products.length === 0) {
          const productTitle = campaignName || 
                              this.getStr(lead, ['ProductName', 'productName', 'FlowName', 'flowName', 'ServiceName', 'serviceName']) ||
                              "Unknown Product";
          products.push({
            name: productTitle,
            externalId: campaignId || "unknown",
            quantity: 1,
            unitPrice: 0,
          });
        }

        const sale: StandardSale = {
          externalId,
          sourceSystem: "enreach" as const,
          saleDate,
          agentEmail,
          agentExternalId: agentId || undefined,
          agentName: agentName || undefined,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          campaignId,
          externalReference,
          clientCampaignId: mapping?.clientCampaignId || null,
          products,
          metadata: {
            source: "enreach",
            campaignName,
            variables: dataObj,
          },
        };

        return sale;
      });

      // Log extraction results for debugging
      const withExternalId = sales.filter(s => s.externalId).length;
      const withAgent = sales.filter(s => s.agentName || s.agentEmail).length;
      const withCustomer = sales.filter(s => s.customerName || s.customerPhone).length;
      console.log(`[EnreachAdapter] Extraction results: ${withExternalId}/${sales.length} with ID, ${withAgent} with agent, ${withCustomer} with customer`);

      return sales;
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
          // Try case-insensitive lookup
          const value = this.getValue(variables, [config.value, config.value.toLowerCase(), config.value.toUpperCase()]);
          return value ? String(value) : null;
        }
        case "json_path": {
          const parts = config.value.split(".");
          let current: unknown = variables;
          for (const part of parts) {
            if (current && typeof current === "object") {
              current = this.getValue(current as Record<string, unknown>, [part]);
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
      "opp", "OPP", "Opp", "opp_number", "OppNumber", "oppNumber",
      "order_id", "OrderId", "orderId", "order_number", "OrderNumber", "orderNumber",
      "reference", "Reference", "ref", "Ref", "external_ref", "ExternalRef", "externalRef",
      "ordreId", "OrdreId", "ordrenummer", "Ordrenummer", "OrdrNr",
      "OpportunityId", "opportunityId", "opportunity_id"
    ];

    for (const field of commonFields) {
      const val = variables[field];
      if (val !== null && val !== undefined && val !== '') {
        return String(val);
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
      const data = await this.get(`/leads/${resultId}`) as Record<string, unknown>;

      const dataObj = (data.data || data.Data || {}) as Record<string, unknown>;
      const customFields = (data.customFields || data.CustomFields || {}) as Record<string, unknown>;
      
      return {
        ...dataObj,
        ...customFields,
      };
    } catch (error) {
      console.error(`[EnreachAdapter] Error fetching lead data for ${resultId}:`, error);
      return {};
    }
  }
}
