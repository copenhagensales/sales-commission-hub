import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardProduct, StandardCall, CampaignMappingConfig, ReferenceExtractionConfig, DialerIntegrationConfig } from "../types.ts";

interface EnreachCredentials {
  username?: string;
  password?: string;
  api_token?: string;
  api_url?: string;
  org_code?: string;
}

// HeroBase API response types
interface HeroBaseLead {
  [key: string]: unknown;
}

export class EnreachAdapter implements DialerAdapter {
  private baseUrl: string;
  private headers: Record<string, string>;
  private dialerName: string;
  private orgCode: string | null;
  private config: DialerIntegrationConfig | null;

  constructor(credentials: EnreachCredentials, dialerName?: string, config?: DialerIntegrationConfig | null) {
    const providedUrl = credentials.api_url || "https://wshero01.herobase.com/api";
    this.baseUrl = providedUrl.endsWith('/') ? providedUrl.slice(0, -1) : providedUrl;
    if (!this.baseUrl.endsWith('/api')) {
      this.baseUrl = this.baseUrl + '/api';
    }
    
    this.dialerName = dialerName || "Enreach";
    this.orgCode = credentials.org_code || null;
    this.config = config || null;
    
    console.log(`[EnreachAdapter] Config loaded: ${JSON.stringify(this.config?.productExtraction || 'None')}`);
    
    let authHeader: string;
    if (credentials.username && credentials.password) {
      const basicAuth = btoa(`${credentials.username}:${credentials.password}`);
      authHeader = `Basic ${basicAuth}`;
    } else if (credentials.api_token) {
      authHeader = `Bearer ${credentials.api_token}`;
    } else {
      throw new Error("[EnreachAdapter] No valid credentials provided.");
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

  private getValue(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
      const lowerKey = key.toLowerCase();
      for (const objKey of Object.keys(obj)) {
        if (objKey.toLowerCase() === lowerKey && obj[objKey] !== undefined && obj[objKey] !== null && obj[objKey] !== '') {
          return obj[objKey];
        }
      }
    }
    return null;
  }

  private getStr(obj: Record<string, unknown> | null | undefined, keys: string[], fallback = ""): string {
    const val = this.getValue(obj, keys);
    if (val === null || val === undefined) return fallback;
    return String(val);
  }

  private async get(endpoint: string): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, { method: "GET", headers: this.headers });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EnreachAdapter] API Error ${response.status}: ${errorText.substring(0, 200)}`);
      throw new Error(`Enreach API error: ${response.status}`);
    }

    return response.json();
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      console.log(`[EnreachAdapter] Fetching ONLY SUCCESS sales for last ${days} days`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const modifiedFrom = cutoffDate.toISOString().split('T')[0];
      
      let allLeads: HeroBaseLead[] = [];
      
      // FILTRADO ESTRICTO: Solo traemos ventas exitosas (LeadClosures=Success)
      // AllClosedStatuses=true es necesario para ver leads ya procesados
      const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&AllClosedStatuses=true&LeadClosures=Success`;
      
      try {
        console.log(`[EnreachAdapter] GET ${endpoint}`);
        const data = await this.get(endpoint) as unknown;
        
        if (Array.isArray(data)) {
          allLeads = data as HeroBaseLead[];
        } else if (data && typeof data === 'object') {
          const wrapper = data as Record<string, unknown>;
          allLeads = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || []) as HeroBaseLead[];
        }
      } catch (error) {
        console.error("[EnreachAdapter] Error fetching leads:", error);
        return [];
      }

      console.log(`[EnreachAdapter] Fetched ${allLeads.length} raw leads from API`);

      // FILTRO INTERNO: Solo procesamos leads que explícitamente tengan closure="Success"
      // Ignoramos el status (UserProcessed) para ser más flexibles, pero el closure es mandatorio.
      const filteredLeads = allLeads.filter((lead) => {
        const closure = this.getStr(lead, ['closure', 'Closure']);
        // HeroBase a veces usa 'Success' y a veces 'success', normalizamos a minúsculas para comparar
        return closure && closure.toLowerCase() === 'success';
      });

      console.log(`[EnreachAdapter] Filtered ${allLeads.length} raw leads down to ${filteredLeads.length} valid sales`);

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
      }

      return filteredLeads.map((lead: HeroBaseLead) => {
        // --- 1. Identificadores Básicos ---
        const externalId = this.getStr(lead, ['uniqueId', 'UniqueId']);
        const campaignObj = (lead.campaign || lead.Campaign) as Record<string, unknown> | undefined;
        const campaignId = campaignObj ? this.getStr(campaignObj, ['uniqueId', 'UniqueId', 'code']) : "";
        const campaignCode = campaignObj ? this.getStr(campaignObj, ['code', 'Code']) : "";
        
        // --- 2. Agente ---
        const firstProcessedByUser = (lead.firstProcessedByUser || lead.FirstProcessedByUser) as Record<string, unknown> | undefined;
        const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
        const agentOrgCode = (firstProcessedByUser?.orgCode as string) || (lastModifiedByUser?.orgCode as string) || "";
        
        // Nombre del agente: intenta buscar nombre real, sino usa el código
        let agentName = this.getStr(firstProcessedByUser, ['name', 'Name', 'fullName']);
        if (!agentName) agentName = agentOrgCode;

        // --- 3. Cliente ---
        const dataObj = (lead.data || lead.Data) as Record<string, unknown> | undefined;
        let customerName = "";
        let customerPhone = "";
        
        if (dataObj) {
          const firstName = this.getStr(dataObj, ['Navn1', 'FirstName', 'Fornavn']);
          const lastName = this.getStr(dataObj, ['Navn2', 'LastName', 'Efternavn']);
          customerName = [firstName, lastName].filter(Boolean).join(' ').trim();
          
          if (!customerName) {
            customerName = this.getStr(dataObj, ['Navn', 'Name', 'Company', 'Firma']);
          }
          
          customerPhone = this.getStr(dataObj, ['Telefon1', 'Telefon', 'Phone', 'Mobile']);
        }

        // --- 4. Extracción de Productos (Dinámica) ---
        const products = this.extractProducts(lead, dataObj, campaignId, campaignCode);

        // --- 5. Referencia Externa (Order ID) ---
        let externalReference: string | null = null;
        const mapping = mappingLookup.get(campaignId);

        // Intento 1: Configuración específica de la campaña
        if (mapping?.referenceConfig && dataObj) {
            externalReference = this.extractReference({...dataObj, ...lead}, mapping.referenceConfig);
        }
        
        // Intento 2: Campos comunes
        if (!externalReference && dataObj) {
            externalReference = this.getStr(dataObj, ['SerioID', 'KVHXR', 'OrderId', 'Reference', 'OrderNumber']) || null;
        }

        const saleDate = this.getStr(lead, ['firstProcessedTime', 'lastModifiedTime']) || new Date().toISOString();

        return {
          externalId,
          integrationType: "enreach",
          dialerName: this.dialerName,
          saleDate,
          agentEmail: agentOrgCode, 
          agentExternalId: agentOrgCode,
          agentName,
          customerName,
          customerPhone,
          campaignId,
          campaignName: campaignCode,
          externalReference,
          clientCampaignId: mapping?.clientCampaignId || null,
          products,
          // Store complete raw JSON from dialer
          rawPayload: lead,
          metadata: {
            source: "enreach",
            campaignName: campaignCode,
            campaignId,
          },
        };
      });
    } catch (error) {
      console.error("[EnreachAdapter] Critical error in fetchSales:", error);
      return [];
    }
  }

  // --- LÓGICA DE EXTRACCIÓN DE PRODUCTOS CONFIGURABLE ---
  private extractProducts(
    lead: HeroBaseLead,
    dataObj: Record<string, unknown> | undefined,
    campaignId: string,
    campaignCode: string
  ): StandardProduct[] {
    const products: StandardProduct[] = [];
    
    const extractionConfig = this.config?.productExtraction;
    const strategy = extractionConfig?.strategy || 'standard_closure';

    // A. Estrategia: Regex en las llaves del objeto data
    if (strategy === 'data_keys_regex' && dataObj && extractionConfig?.regexPattern) {
        try {
            const regex = new RegExp(extractionConfig.regexPattern, 'i');
            for (const [key, value] of Object.entries(dataObj)) {
                if (value && String(value).length > 0) {
                    const match = key.match(regex);
                    if (match) {
                        const name = match[1]?.trim() || key;
                        const priceStr = match[2]?.replace(',', '.') || '0';
                        
                        products.push({
                            name: name,
                            externalId: key, 
                            quantity: 1,
                            unitPrice: parseFloat(priceStr)
                        });
                    }
                }
            }
        } catch (e) {
            console.error("[EnreachAdapter] Invalid regex:", e);
        }
    }

    // B. Estrategia: Campos específicos
    if (strategy === 'specific_fields' && dataObj && extractionConfig?.targetKeys) {
        for (const key of extractionConfig.targetKeys) {
            const val = this.getValue(dataObj, [key]);
            if (val && String(val).trim().length > 0) {
                products.push({
                    name: String(val),
                    externalId: String(val), 
                    quantity: 1,
                    unitPrice: 0 
                });
            }
        }
    }

    // C. Estrategia: Standard Closure
    const closureData = (lead.closureData || lead.ClosureData) as any[];
    if (products.length === 0 && Array.isArray(closureData) && closureData.length > 0) {
        for (const item of closureData) {
            products.push({
                name: item.text || item.productName || "Unknown",
                externalId: item.sku || item.id || "unknown",
                quantity: Number(item.amount || item.quantity || 1),
                unitPrice: Number(item.price || item.amount || 0)
            });
        }
    }

    // D. Fallback final
    if (products.length === 0) {
        const fallbackName = extractionConfig?.defaultName || campaignCode || "Venta General";
        products.push({
            name: fallbackName,
            externalId: campaignId || "unknown",
            quantity: 1,
            unitPrice: 0
        });
    }

    return products;
  }

  private extractReference(variables: Record<string, unknown>, config: ReferenceExtractionConfig): string | null {
    try {
      if (config.type === 'field_id') {
        return this.getStr(variables, [config.value]);
      }
      return null; 
    } catch (e) { return null; }
  }

  private searchForOppInVariables(variables: Record<string, unknown>): string | null {
    for (const [key, value] of Object.entries(variables)) {
        if (typeof value === 'string' && (key.toLowerCase().includes('opp') || key.toLowerCase().includes('order'))) {
             return value;
        }
    }
    return null;
  }

  async fetchUsers(): Promise<StandardUser[]> { return []; }
  async fetchCampaigns(): Promise<StandardCampaign[]> { return []; }
  async fetchCalls(): Promise<StandardCall[]> { return []; }
}
