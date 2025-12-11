import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct, StandardCall, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";

interface EnreachCredentials {
  username?: string;
  password?: string;
  api_token?: string;
  api_url?: string; // Full base URL like https://wshero01.herobase.com/api
  org_code?: string; // Optional OrgCode for calls endpoint
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
  private dialerName: string;
  private orgCode: string | null;
  private username: string | null;

  constructor(credentials: EnreachCredentials, dialerName?: string) {
    // Default to wshero01.herobase.com/api if not provided
    const providedUrl = credentials.api_url || "https://wshero01.herobase.com/api";
    // Ensure no trailing slash
    this.baseUrl = providedUrl.endsWith('/') ? providedUrl.slice(0, -1) : providedUrl;
    // Ensure /api suffix
    if (!this.baseUrl.endsWith('/api')) {
      this.baseUrl = this.baseUrl + '/api';
    }
    
    this.dialerName = dialerName || "Enreach";
    this.orgCode = credentials.org_code || null;
    this.username = credentials.username || null;
    console.log(`[EnreachAdapter] Base URL: ${this.baseUrl}, Dialer: ${this.dialerName}, OrgCode from config: ${this.orgCode || 'not set'}`);
    
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

  setDialerName(name: string) {
    this.dialerName = name;
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

  private async get(endpoint: string): Promise<unknown> {
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

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const modifiedFrom = cutoffDate.toISOString().split('T')[0];
      
      let allLeads: HeroBaseLead[] = [];
      
      try {
        const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&Statuses=UserProcessed&LeadClosures=Success`;
        console.log(`[EnreachAdapter] Fetching from: ${endpoint}`);
        const data = await this.get(endpoint) as unknown;
        
        if (Array.isArray(data)) {
          allLeads = data as HeroBaseLead[];
        } else if (data && typeof data === 'object') {
          const wrapper = data as Record<string, unknown>;
          allLeads = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || wrapper.Data || wrapper.data || []) as HeroBaseLead[];
        }
      } catch (primaryError) {
        console.warn("[EnreachAdapter] Primary fetch failed, trying alternative endpoint:", primaryError);
        try {
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
      
      if (allLeads.length > 0) {
        console.log(`[EnreachAdapter] Sample lead keys: ${Object.keys(allLeads[0]).slice(0, 15).join(', ')}`);
      }

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
        console.log(`[EnreachAdapter] Loaded ${campaignMappings.length} campaign mappings`);
      }

      const sales = allLeads.map((lead: HeroBaseLead) => {
        // ===== HEROBASE SPECIFIC FIELD EXTRACTION =====
        // The structure is: uniqueId, campaign: {uniqueId, code}, data: {Navn1, Navn2, Telefon1...}, firstProcessedByUser: {orgCode}
        
        // External ID - top level uniqueId
        const externalId = this.getStr(lead, ['uniqueId', 'UniqueId']);

        // Campaign info - nested in campaign object
        const campaignObj = (lead.campaign || lead.Campaign) as Record<string, unknown> | undefined;
        const campaignId = campaignObj ? this.getStr(campaignObj, ['uniqueId', 'UniqueId', 'code']) : "";
        const campaignCode = campaignObj ? this.getStr(campaignObj, ['code', 'Code']) : "";
        
        // Agent info - from firstProcessedByUser object
        const firstProcessedByUser = (lead.firstProcessedByUser || lead.FirstProcessedByUser) as Record<string, unknown> | undefined;
        const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
        
        // Try to get full name from user object first
        let agentName = "";
        if (firstProcessedByUser) {
          agentName = this.getStr(firstProcessedByUser, ['name', 'Name', 'fullName', 'FullName', 'displayName', 'DisplayName']);
        }
        if (!agentName && lastModifiedByUser) {
          agentName = this.getStr(lastModifiedByUser, ['name', 'Name', 'fullName', 'FullName', 'displayName', 'DisplayName']);
        }
        
        // Get orgCode as a fallback identifier and email
        const agentOrgCode = (firstProcessedByUser?.orgCode as string) || 
                           (lastModifiedByUser?.orgCode as string) || "";
        
        const agentEmail = this.getStr(firstProcessedByUser || {}, ['email', 'Email', 'emailAddress', 'EmailAddress']) ||
                          this.getStr(lastModifiedByUser || {}, ['email', 'Email', 'emailAddress', 'EmailAddress']) ||
                          this.getStr(lead, ['agentEmail', 'AgentEmail', 'userEmail', 'UserEmail']) ||
                          agentOrgCode; // Use orgCode as fallback
        
        // If we still don't have a name, use orgCode as the name
        if (!agentName) {
          agentName = agentOrgCode;
        }
        
        // Log for debugging first few leads
        if (allLeads.indexOf(lead) < 3) {
          console.log(`[EnreachAdapter] Agent extraction - orgCode: ${agentOrgCode}, name: ${agentName}, email: ${agentEmail}, firstProcessedByUser keys: ${firstProcessedByUser ? Object.keys(firstProcessedByUser).join(', ') : 'null'}`);
        }

        // Customer data - nested in 'data' object (HeroBase specific)
        const dataObj = (lead.data || lead.Data) as Record<string, unknown> | undefined;
        
        let customerName = "";
        let customerPhone = "";
        let customerAddress = "";
        
        if (dataObj) {
          // Name: Navn1 (first name) + Navn2 (last name)
          const firstName = this.getStr(dataObj, ['Navn1', 'navn1', 'FirstName', 'firstName']);
          const lastName = this.getStr(dataObj, ['Navn2', 'navn2', 'LastName', 'lastName']);
          customerName = [firstName, lastName].filter(Boolean).join(' ').trim();
          
          // Phone: Telefon1, Telefon2, Telefon3 (try in order)
          customerPhone = this.getStr(dataObj, ['Telefon1', 'telefon1', 'Phone1', 'phone1']) ||
                         this.getStr(dataObj, ['Telefon2', 'telefon2', 'Phone2', 'phone2']) ||
                         this.getStr(dataObj, ['Telefon3', 'telefon3', 'Phone3', 'phone3']) ||
                         this.getStr(dataObj, ['Telefon', 'telefon', 'Phone', 'phone', 'Mobile', 'mobile']);
          
          // Address (for context)
          const address = this.getStr(dataObj, ['Adresse', 'adresse', 'Address', 'address']);
          const city = this.getStr(dataObj, ['By', 'by', 'City', 'city']);
          const postalCode = this.getStr(dataObj, ['Postnummer', 'postnummer', 'PostalCode', 'postalCode', 'Zip', 'zip']);
          customerAddress = [address, postalCode, city].filter(Boolean).join(', ');
        }
        
        // Fallback to top-level fields if data object extraction failed
        if (!customerName) {
          customerName = this.getStr(lead, ['company', 'Company', 'name', 'Name', 'customerName', 'CustomerName']);
        }
        if (!customerPhone) {
          customerPhone = this.getStr(lead, ['phone', 'Phone', 'phoneNumber', 'PhoneNumber', 'mobile', 'Mobile']);
        }

        // Sale date - firstProcessedTime (when the sale was made)
        const saleDate = this.getStr(lead, [
          'firstProcessedTime', 'FirstProcessedTime',
          'lastModifiedTime', 'LastModifiedTime', 
          'soldTime', 'SoldTime', 'soldDate', 'SoldDate',
          'closedTime', 'ClosedTime', 'createdTime', 'CreatedTime'
        ]) || new Date().toISOString();

        const mapping = mappingLookup.get(campaignId);
        
        // External reference - check data object for SerioID, KVHXR, or OPP patterns
        let externalReference: string | null = null;
        
        // First try config-based extraction
        if (mapping?.referenceConfig) {
          const allVariables = { ...dataObj, ...lead };
          externalReference = this.extractReference(allVariables as Record<string, unknown>, mapping.referenceConfig);
          if (externalReference) {
            console.log(`[EnreachAdapter] Extracted reference via config: ${externalReference}`);
          }
        }
        
        // Then try HeroBase specific fields
        if (!externalReference && dataObj) {
          externalReference = this.getStr(dataObj, ['SerioID', 'serioID', 'SERIO_ID']) ||
                             this.getStr(dataObj, ['KVHXR', 'kvhxr']) ||
                             this.getStr(dataObj, ['OrderId', 'orderId', 'order_id', 'OrdreId']) ||
                             this.getStr(dataObj, ['Reference', 'reference', 'Ref', 'ref']) ||
                             null;
        }
        
        // Finally search for OPP patterns
        if (!externalReference) {
          const allVariables = { ...dataObj, ...lead };
          externalReference = this.searchForOppInVariables(allVariables as Record<string, unknown>);
        }

        // Products - not typically present in HeroBase simpleleads, create from campaign
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

        if (products.length === 0) {
          // Create product from campaign info
          const productTitle = campaignCode || campaignId || "Unknown Product";
          products.push({
            name: productTitle,
            externalId: campaignId || "unknown",
            quantity: 1,
            unitPrice: 0,
          });
        }

        // Owner org unit - for metadata
        const ownerOrgUnit = (lead.ownerOrgUnit || lead.OwnerOrgUnit) as Record<string, unknown> | undefined;
        const organization = ownerOrgUnit?.orgCode as string || "";

        const sale: StandardSale = {
          externalId,
          integrationType: "enreach" as const,
          dialerName: this.dialerName,
          saleDate,
          agentEmail,
          agentExternalId: agentEmail || undefined, // Use email as ID for HeroBase
          agentName: agentName || undefined,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          campaignId,
          campaignName: campaignCode || campaignId || undefined,
          externalReference,
          clientCampaignId: mapping?.clientCampaignId || null,
          products,
          metadata: {
            source: "enreach",
            campaignName: campaignCode,
            campaignId,
            organization,
            customerAddress,
            rawData: dataObj,
          },
        };

        return sale;
      });

      // Log extraction stats
      const withExternalId = sales.filter(s => s.externalId).length;
      const withAgent = sales.filter(s => s.agentName || s.agentEmail).length;
      const withCustomer = sales.filter(s => s.customerName || s.customerPhone).length;
      const withReference = sales.filter(s => s.externalReference).length;
      console.log(`[EnreachAdapter] Extraction results: ${withExternalId}/${sales.length} with ID, ${withAgent} with agent, ${withCustomer} with customer, ${withReference} with reference`);

      return sales;
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching sales:", error);
      return [];
    }
  }

  private extractReference(
    variables: Record<string, unknown>,
    config: ReferenceExtractionConfig
  ): string | null {
    try {
      switch (config.type) {
        case "field_id": {
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

  /**
   * GDPR-Compliant CDR fetch - only IDs and metadata, NO personal Lead data
   * Uses HeroBase /organizationalunits/{OrgCode}/calls endpoint for Call Detail Records
   * REQUIRES: org_code to be configured in the integration
   */
  async fetchCalls(days: number): Promise<StandardCall[]> {
    try {
      // OrgCode is required for HeroBase calls API
      const orgCode = this.orgCode;
      
      if (!orgCode) {
        console.error("[EnreachAdapter] OrgCode is REQUIRED for fetching calls. Please configure org_code in the integration settings.");
        return [];
      }

      // Calculate TimeSpan format: "d.hh:mm:ss" (e.g., "7.00:00:00" for 7 days)
      const timeSpan = `${days}.00:00:00`;
      
      // StartTime in ISO format
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateIso = startDate.toISOString();

      console.log(`[EnreachAdapter] Fetching calls for OrgCode: ${orgCode}, TimeSpan: ${timeSpan}`);

      let allCalls: Record<string, unknown>[] = [];
      
      // HeroBase API: /organizationalunits/{OrgCode}/calls?StartTime=YYYY-MM-DDTHH:mm:ss&TimeSpan=d.HH:mm:ss
      const endpoint = `/organizationalunits/${encodeURIComponent(orgCode)}/calls?StartTime=${encodeURIComponent(startDateIso)}&TimeSpan=${encodeURIComponent(timeSpan)}&Limit=1000`;
      
      try {
        console.log(`[EnreachAdapter] GET ${this.baseUrl}${endpoint}`);
        const data = await this.get(endpoint) as unknown;
        
        if (Array.isArray(data)) {
          allCalls = data as Record<string, unknown>[];
        } else if (data && typeof data === 'object') {
          const wrapper = data as Record<string, unknown>;
          console.log(`[EnreachAdapter] Response keys: ${Object.keys(wrapper).slice(0, 10).join(', ')}`);
          
          allCalls = (
            wrapper.Results || wrapper.results || 
            wrapper.Calls || wrapper.calls || 
            wrapper.Data || wrapper.data || 
            []
          ) as Record<string, unknown>[];
        }
        
        console.log(`[EnreachAdapter] Fetched ${allCalls.length} calls`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[EnreachAdapter] Failed to fetch calls: ${errMsg}`);
        return [];
      }

      if (allCalls.length === 0) {
        console.log("[EnreachAdapter] No call records found");
        return [];
      }

      // Log sample record structure for debugging
      if (allCalls.length > 0) {
        console.log(`[EnreachAdapter] Sample call keys: ${Object.keys(allCalls[0]).slice(0, 20).join(', ')}`);
      }

      // Map to StandardCall (GDPR-compliant - only IDs)
      return allCalls.map((call) => {
        // Determine status from endCause and connected flag
        // endCause: 'NotApplicable', 'NormalDisconnect', 'NoResponse', 'Busy', 'VoiceMail', 'DroppedCall', 'DialingCancelled'
        const connected = Boolean(this.getValue(call, ['connected', 'Connected']));
        const endCause = this.getStr(call, ['endCause', 'EndCause']);
        const status = this.mapEnreachEndCause(endCause, connected);
        
        // Times - API provides startTime, connectTime (optional), endTime (optional)
        const callStartTime = this.getStr(call, ['startTime', 'StartTime']) || new Date().toISOString();
        const connectTime = this.getStr(call, ['connectTime', 'ConnectTime']);
        const callEndTime = this.getStr(call, ['endTime', 'EndTime']) || callStartTime;

        // Duration extraction - HeroBase uses TimeSpan format like "00:01:30" or seconds
        // conversationDuration: talk time (only if connected)
        // dialingDuration: time spent dialing
        // wrapUpDuration: wrap up time
        const conversationDuration = this.parseTimeSpan(
          this.getValue(call, ['conversationDuration', 'ConversationDuration'])
        );
        const dialingDuration = this.parseTimeSpan(
          this.getValue(call, ['dialingDuration', 'DialingDuration'])
        );
        const wrapUpDuration = this.parseTimeSpan(
          this.getValue(call, ['wrapUpDuration', 'WrapUpDuration'])
        );
        
        // durationSeconds = conversation time (talk time)
        // totalDurationSeconds = dialing + conversation + wrapup
        const durationSeconds = conversationDuration;
        const totalDurationSeconds = dialingDuration + conversationDuration + wrapUpDuration;

        // Extract user/agent info from nested user object
        // user: { uniqueId, username, name, orgCode, email }
        const userObj = (call.user || call.User) as Record<string, unknown> | undefined;
        let agentExternalId = "";
        let agentEmail = "";
        let agentName = "";
        
        if (userObj) {
          agentExternalId = this.getStr(userObj, ['uniqueId', 'UniqueId', 'orgCode', 'OrgCode']);
          agentEmail = this.getStr(userObj, ['email', 'Email']);
          agentName = this.getStr(userObj, ['name', 'Name', 'username', 'Username']);
        }

        // Campaign info from nested campaign object
        // campaign: { uniqueId, name, code, project }
        const campaignObj = (call.campaign || call.Campaign) as Record<string, unknown> | undefined;
        let campaignExternalId = "";
        let campaignName = "";
        
        if (campaignObj) {
          campaignExternalId = this.getStr(campaignObj, ['uniqueId', 'UniqueId', 'code', 'Code']);
          campaignName = this.getStr(campaignObj, ['name', 'Name', 'code', 'Code']);
        }

        // Lead ID - uniqueLeadId from API (ONLY the ID, never personal data - GDPR)
        const leadExternalId = this.getStr(call, ['uniqueLeadId', 'UniqueLeadId', 'leadId', 'LeadId']);

        // Recording URL - needs separate /calls/{UniqueId}/recordings endpoint
        // For now, construct potential URL pattern
        const callUniqueId = this.getStr(call, ['uniqueId', 'UniqueId']);
        const recordingUrl = callUniqueId ? `${this.baseUrl}/calls/${callUniqueId}/recordings` : undefined;

        return {
          externalId: callUniqueId,
          integrationType: "enreach" as const,
          dialerName: this.dialerName,
          
          startTime: callStartTime,
          endTime: callEndTime,
          
          durationSeconds,
          totalDurationSeconds,
          
          status,
          
          // ONLY IDs - No personal data (GDPR compliant)
          agentExternalId,
          campaignExternalId,
          leadExternalId,
          
          recordingUrl,
          
          metadata: {
            endCause,
            connected,
            connectTime,
            incoming: Boolean(this.getValue(call, ['incoming', 'Incoming'])),
            leadStatus: this.getStr(call, ['leadStatus', 'LeadStatus']),
            leadClosure: this.getStr(call, ['leadClosure', 'LeadClosure']),
            campaignType: this.getStr(call, ['campaignType', 'CampaignType']),
            agentEmail,
            agentName,
            campaignName,
          },
        };
      });
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching calls:", error);
      return [];
    }
  }

  /**
   * Parse TimeSpan format (d.hh:mm:ss or hh:mm:ss or seconds) to total seconds
   */
  private parseTimeSpan(value: unknown): number {
    if (!value) return 0;
    
    // If already a number, return it
    if (typeof value === 'number') return value;
    
    const str = String(value);
    
    // Try parsing as "d.hh:mm:ss" or "hh:mm:ss" or "mm:ss"
    const parts = str.split(':');
    
    if (parts.length === 3) {
      // hh:mm:ss or d.hh:mm:ss
      let hours = 0;
      let days = 0;
      
      // Check for days prefix like "1.02:30:00"
      if (parts[0].includes('.')) {
        const dayHour = parts[0].split('.');
        days = parseInt(dayHour[0], 10) || 0;
        hours = parseInt(dayHour[1], 10) || 0;
      } else {
        hours = parseInt(parts[0], 10) || 0;
      }
      
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseInt(parts[2], 10) || 0;
      
      return (days * 24 * 3600) + (hours * 3600) + (minutes * 60) + seconds;
    } else if (parts.length === 2) {
      // mm:ss
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return (minutes * 60) + seconds;
    }
    
    // Try parsing as plain number
    return parseInt(str, 10) || 0;
  }

  /**
   * Map Enreach/HeroBase endCause to unified status enum
   * endCause values: 'NotApplicable', 'NormalDisconnect', 'NoResponse', 'Busy', 'VoiceMail', 'DroppedCall', 'DialingCancelled'
   */
  private mapEnreachEndCause(cause: string | undefined, connected?: boolean): StandardCall['status'] {
    // If connected is true and normal disconnect, it was answered
    if (connected) {
      return 'ANSWERED';
    }
    
    if (!cause) return 'OTHER';
    
    const c = cause.toLowerCase();
    
    switch (c) {
      case 'normaldisconnect':
        return connected ? 'ANSWERED' : 'NO_ANSWER';
      case 'noresponse':
        return 'NO_ANSWER';
      case 'busy':
        return 'BUSY';
      case 'voicemail':
        return 'NO_ANSWER'; // Voicemail = didn't reach person
      case 'droppedcall':
        return 'FAILED';
      case 'dialingcancelled':
        return 'FAILED';
      case 'notapplicable':
        return 'OTHER';
      default:
        // Fallback pattern matching
        if (c.includes('answer')) return 'ANSWERED';
        if (c.includes('busy')) return 'BUSY';
        if (c.includes('no_answer') || c.includes('noanswer')) return 'NO_ANSWER';
        if (c.includes('fail') || c.includes('error')) return 'FAILED';
        return 'OTHER';
    }
  }
}
