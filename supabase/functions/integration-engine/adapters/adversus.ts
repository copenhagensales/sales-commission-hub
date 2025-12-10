import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";

export class AdversusAdapter implements DialerAdapter {
  private authHeader: string;
  private baseUrl = "https://api.adversus.io/v1";
  private dialerName: string;

  constructor(secrets?: Record<string, string> | string[] | null, dialerName?: string) {
    // Support both object secrets and env vars
    let user: string | undefined;
    let pass: string | undefined;

    if (secrets && typeof secrets === "object" && !Array.isArray(secrets)) {
      user = secrets.ADVERSUS_API_USERNAME;
      pass = secrets.ADVERSUS_API_PASSWORD;
    }

    // Fallback to env vars
    user = user || Deno.env.get("ADVERSUS_API_USERNAME");
    pass = pass || Deno.env.get("ADVERSUS_API_PASSWORD");

    if (!user || !pass) throw new Error("Credenciales Adversus faltantes");
    this.authHeader = btoa(`${user}:${pass}`);
    this.dialerName = dialerName || "Lovablecph";
  }

  setDialerName(name: string) {
    this.dialerName = name;
  }

  private async get(endpoint: string) {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" },
    });
    if (res.status === 429) throw new Error("Rate Limit Adversus Excedido");
    if (!res.ok) throw new Error(`Adversus API Error ${res.status}`);
    return await res.json();
  }

  async fetchUsers(): Promise<StandardUser[]> {
    const data = await this.get("/users");
    const users = data.users || data || [];

    return users.map((u: any) => ({
      externalId: String(u.id),
      name: u.name || u.displayName,
      email: u.email || `agent-${u.id}@adversus.local`,
      isActive: u.active,
    }));
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    const data = await this.get("/campaigns");
    const campaigns = data.campaigns || data || [];

    return campaigns.map((c: any) => ({
      externalId: String(c.id),
      name: c.settings?.name || c.name,
      isActive: c.active !== false,
    }));
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }));

    let page = 1;
    let rawSales: any[] = [];
    let hasMore = true;

    // Build campaign lookup maps
    const campaignConfigMap = new Map<string, CampaignMappingConfig>();
    campaignMappings?.forEach(m => campaignConfigMap.set(m.adversusCampaignId, m));

    // Paginación segura
    while (hasMore && page <= 50) {
      const url = `${this.baseUrl}/sales?pageSize=100&page=${page}&filters=${filterStr}`;
      const res = await fetch(url, { headers: { Authorization: `Basic ${this.authHeader}` } });

      if (!res.ok) break;
      const data = await res.json();
      const pageData = data.sales || data || [];

      if (pageData.length === 0) hasMore = false;
      else {
        rawSales = [...rawSales, ...pageData];
        page++;
      }
      // Pequeño delay para no saturar la API
      await new Promise((r) => setTimeout(r, 100));
    }

    // Mapeo a StandardSale with reference extraction
    return rawSales.map((s: any) => {
      // Extraer agente de forma segura
      const agentObj = s.ownedBy || s.createdBy;
      const agentId = typeof agentObj === "object" ? agentObj.id : agentObj;
      const agentEmail = typeof agentObj === "object" ? agentObj.email : `agent-${agentId}@adversus.local`;
      const agentName = typeof agentObj === "object" ? agentObj.name || agentObj.displayName : "Desconocido";

      // Extract lead resultData for reference extraction
      const resultData = s.lead?.resultData || s.resultData || {};
      const campaignId = s.campaignId ? String(s.campaignId) : undefined;

      // Extract external reference (OPP) using campaign config
      let externalReference: string | null = null;
      let clientCampaignId: string | null = null;

      if (campaignId && campaignConfigMap.has(campaignId)) {
        const mapping = campaignConfigMap.get(campaignId)!;
        clientCampaignId = mapping.clientCampaignId;

        if (mapping.referenceConfig) {
          externalReference = this.extractReference(resultData, mapping.referenceConfig);
        }
      }

      // Fallback: search for common OPP patterns if no config match
      if (!externalReference) {
        externalReference = this.searchForOppInResultData(resultData);
      }
      
      return {
        externalId: String(s.id),
        integrationType: "adversus" as const,
        dialerName: this.dialerName,
        saleDate: s.closedTime || s.createdTime,

        agentExternalId: String(agentId),
        agentEmail: agentEmail,
        agentName: agentName,

        customerName: s.lead?.company || s.lead?.name || "",
        customerPhone: s.lead?.phone || "",
        
        campaignId: campaignId,
        externalReference: externalReference,
        clientCampaignId: clientCampaignId,

        products: (s.lines || []).map((l: any) => ({
          name: l.title || "Producto desconocido",
          externalId: String(l.productId),
          quantity: l.quantity || 1,
          unitPrice: l.unitPrice || 0,
          metadata: { rawLineId: l.id },
        })),

        metadata: {
          campaignId: s.campaignId,
          leadId: s.leadId,
          resultData: resultData,
          lead: s.lead,
        },
      };
    });
  }

  // Fetch a specific lead's resultData (for field inspection)
  async fetchLeadResultData(leadId: string): Promise<Record<string, unknown>> {
    try {
      const url = `${this.baseUrl}/leads/${leadId}`;
      const res = await fetch(url, { 
        headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" } 
      });
      
      if (!res.ok) {
        console.log(`[Adversus] Failed to fetch lead ${leadId}: ${res.status}`);
        return {};
      }
      
      const data = await res.json();
      console.log(`[Adversus] Lead ${leadId} raw response keys: ${Object.keys(data).join(', ')}`);
      
      // Adversus API returns { leads: [...] } - the lead data is inside the array
      const lead = Array.isArray(data.leads) && data.leads.length > 0 ? data.leads[0] : data;
      console.log(`[Adversus] Lead ${leadId} object keys: ${Object.keys(lead).join(', ')}`);
      
      // Adversus returns resultData as an array of {id, value} objects
      const resultDataArray = lead.resultData || [];
      const masterDataArray = lead.masterData || [];
      
      console.log(`[Adversus] Lead ${leadId} resultData type: ${typeof resultDataArray}, isArray: ${Array.isArray(resultDataArray)}, length: ${Array.isArray(resultDataArray) ? resultDataArray.length : 'N/A'}`);
      
      const result: Record<string, unknown> = {};
      
      // Add resultData fields (these are the custom fields we want)
      if (Array.isArray(resultDataArray)) {
        for (const field of resultDataArray) {
          if (field.id !== undefined) {
            result[`result_${field.id}`] = field.value;
          }
        }
        console.log(`[Adversus] Parsed ${resultDataArray.length} resultData fields`);
      }
      
      // Also add masterData fields for reference
      if (Array.isArray(masterDataArray)) {
        for (const field of masterDataArray) {
          if (field.id !== undefined) {
            result[`master_${field.id}`] = field.value;
          }
        }
        console.log(`[Adversus] Parsed ${masterDataArray.length} masterData fields`);
      }
      
      return result;
    } catch (e) {
      console.error(`[Adversus] Error fetching lead ${leadId}:`, e);
      return {};
    }
  }

  // Fetch sales with enriched lead data (for field inspection)
  async fetchSalesWithLeadData(days: number, campaignId?: string): Promise<{ sale: any; resultData: Record<string, unknown> }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Adversus API doesn't support campaignId filter well (returns 500), so we fetch all and filter client-side
    const filterObj = { created: { $gt: startDate.toISOString() } };
    const filterStr = encodeURIComponent(JSON.stringify(filterObj));

    console.log(`[Adversus] Fetching recent sales (last ${days} days) to find campaign ${campaignId}`);
    
    // Fetch more sales to increase chance of finding matching campaign
    const url = `${this.baseUrl}/sales?pageSize=100&page=1&filters=${filterStr}`;
    const res = await fetch(url, { headers: { Authorization: `Basic ${this.authHeader}` } });

    if (!res.ok) {
      console.log(`[Adversus] Failed to fetch sales: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const allSales = data.sales || data || [];

    console.log(`[Adversus] Fetched ${allSales.length} total sales`);

    // Filter by campaignId if provided
    let matchingSales = allSales;
    if (campaignId) {
      matchingSales = allSales.filter((s: any) => String(s.campaignId) === campaignId);
      console.log(`[Adversus] Found ${matchingSales.length} sales for campaign ${campaignId}`);
    }

    if (matchingSales.length === 0) {
      // List available campaigns from fetched sales for debugging
      const campaignIds = [...new Set(allSales.map((s: any) => s.campaignId))];
      console.log(`[Adversus] Available campaigns in fetched data: ${campaignIds.join(', ')}`);
      return [];
    }

    return this.enrichSalesWithLeadData(matchingSales);
  }

  // Helper to enrich sales with lead resultData
  private async enrichSalesWithLeadData(sales: any[]): Promise<{ sale: any; resultData: Record<string, unknown> }[]> {
    const results: { sale: any; resultData: Record<string, unknown> }[] = [];
    
    for (const sale of sales.slice(0, 5)) { // Check first 5 sales to find one with data
      const leadId = sale.leadId;
      console.log(`[Adversus] Checking sale ${sale.id} with leadId: ${leadId}`);
      
      if (!leadId) {
        console.log(`[Adversus] Sale ${sale.id} has no leadId`);
        continue;
      }

      const resultData = await this.fetchLeadResultData(String(leadId));
      console.log(`[Adversus] Lead ${leadId} resultData keys: ${Object.keys(resultData).join(', ') || '(empty)'}`);
      
      if (Object.keys(resultData).length > 0) {
        results.push({ sale, resultData });
        console.log(`[Adversus] Found ${Object.keys(resultData).length} fields in lead ${leadId}`);
        break; // Found one with data, stop
      }
      
      // Small delay between requests
      await new Promise((r) => setTimeout(r, 100));
    }

    // If no lead data found, still return the first sale with inline resultData
    if (results.length === 0 && sales.length > 0) {
      const inlineResultData = sales[0].lead?.resultData || {};
      console.log(`[Adversus] Using inline resultData from sale, keys: ${Object.keys(inlineResultData).join(', ') || '(empty)'}`);
      results.push({ 
        sale: sales[0], 
        resultData: inlineResultData 
      });
    }

    return results;
  }

  // Extract reference value based on config type
  private extractReference(resultData: Record<string, unknown>, config: ReferenceExtractionConfig): string | null {
    const { type, value } = config;

    switch (type) {
      case "field_id": {
        // Direct field ID lookup in resultData
        const fieldValue = resultData[value];
        if (fieldValue !== undefined && fieldValue !== null) {
          const strValue = String(fieldValue).trim();
          if (strValue && strValue !== 'null' && strValue !== 'undefined') {
            console.log(`[Adversus] Found reference via field_id ${value}: ${strValue}`);
            return strValue;
          }
        }
        break;
      }
      case "json_path": {
        // Simple dot-notation path traversal
        const parts = value.split(".");
        let current: any = resultData;
        for (const part of parts) {
          if (current === undefined || current === null) break;
          current = current[part];
        }
        if (current !== undefined && current !== null) {
          const strValue = String(current).trim();
          if (strValue && strValue !== 'null' && strValue !== 'undefined') {
            console.log(`[Adversus] Found reference via json_path ${value}: ${strValue}`);
            return strValue;
          }
        }
        break;
      }
      case "regex": {
        // Search all string values in resultData for regex match
        const regex = new RegExp(value);
        for (const [, fieldValue] of Object.entries(resultData)) {
          if (typeof fieldValue === "string") {
            const match = fieldValue.match(regex);
            if (match) {
              console.log(`[Adversus] Found reference via regex ${value}: ${match[0]}`);
              return match[0];
            }
          }
        }
        break;
      }
      case "static": {
        // Static value (rarely used, but supported)
        return value;
      }
    }

    return null;
  }

  // Fallback: Search for OPP-like values in resultData
  private searchForOppInResultData(resultData: Record<string, unknown>): string | null {
    const oppPatterns = ['opp', 'order', 'ordre', 'reference', 'policy', 'ref'];
    
    for (const [key, value] of Object.entries(resultData)) {
      if (value === null || value === undefined) continue;
      
      const keyLower = key.toLowerCase();
      
      // Check if key matches common patterns
      for (const pattern of oppPatterns) {
        if (keyLower.includes(pattern)) {
          const strValue = String(value).trim();
          if (strValue && strValue !== 'null' && strValue !== 'undefined') {
            return strValue;
          }
        }
      }
      
      // Check if value looks like an OPP
      const strValue = String(value).trim();
      if (strValue.toUpperCase().startsWith('OPP-') || strValue.toUpperCase().startsWith('OPP')) {
        return strValue;
      }
    }
    
    return null;
  }
}
