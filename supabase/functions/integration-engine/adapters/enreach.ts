import { DialerAdapter } from "./interface.ts";
import {
  StandardSale,
  StandardUser,
  StandardCampaign,
  StandardProduct,
  StandardCall,
  CampaignMappingConfig,
  ReferenceExtractionConfig,
  DialerIntegrationConfig,
  ConditionalExtractionRule,
  DataFilterRule,
} from "../types.ts";

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
    this.baseUrl = providedUrl.endsWith("/") ? providedUrl.slice(0, -1) : providedUrl;
    if (!this.baseUrl.endsWith("/api")) {
      this.baseUrl = this.baseUrl + "/api";
    }

    this.dialerName = dialerName || "Enreach";
    this.orgCode = credentials.org_code || null;
    this.config = config || null;

    console.log(`[EnreachAdapter] Config loaded: ${JSON.stringify(this.config?.productExtraction || "None")}`);

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
      Authorization: authHeader,
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    };
  }

  setDialerName(name: string) {
    this.dialerName = name;
  }

  private getValue(obj: Record<string, unknown> | null | undefined, keys: string[]): unknown {
    if (!obj || typeof obj !== "object") return null;
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
      const lowerKey = key.toLowerCase();
      for (const objKey of Object.keys(obj)) {
        if (
          objKey.toLowerCase() === lowerKey &&
          obj[objKey] !== undefined &&
          obj[objKey] !== null &&
          obj[objKey] !== ""
        ) {
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

  // Helper para obtener TODAS las páginas de leads
  private async fetchAllPages(baseEndpoint: string): Promise<HeroBaseLead[]> {
    let allLeads: HeroBaseLead[] = [];
    let skip = 0;
    const take = 1000; // Pedimos bloques de 1000
    let hasMore = true;
    let page = 1;

    console.log(`[EnreachAdapter] Starting pagination loop on: ${baseEndpoint}`);

    while (hasMore) {
      // Importante: añadimos skip y take a la URL existente
      const separator = baseEndpoint.includes("?") ? "&" : "?";
      const pagedEndpoint = `${baseEndpoint}${separator}skip=${skip}&take=${take}`;

      try {
        const data = (await this.get(pagedEndpoint)) as unknown;
        let pageResults: HeroBaseLead[] = [];

        if (Array.isArray(data)) {
          pageResults = data as HeroBaseLead[];
        } else if (data && typeof data === "object") {
          const wrapper = data as Record<string, unknown>;
          pageResults = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || []) as HeroBaseLead[];
        }

        if (pageResults.length > 0) {
          allLeads.push(...pageResults);
          console.log(`[EnreachAdapter] Page ${page}: fetched ${pageResults.length} leads (Total: ${allLeads.length})`);

          if (pageResults.length < take) {
            hasMore = false; // Si devuelve menos de lo que pedimos, es la última página
          } else {
            skip += take;
            page++;
            // Pequeña pausa para no saturar la API
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } else {
          hasMore = false;
        }
      } catch (e) {
        console.error(`[EnreachAdapter] Error fetching page ${page}:`, e);
        // En caso de error, paramos para no buclear infinitamente, pero devolvemos lo que tengamos
        hasMore = false;
      }
    }

    return allLeads;
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      console.log(`[EnreachAdapter] Fetching ONLY SUCCESS sales for last ${days} days`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const modifiedFrom = cutoffDate.toISOString().split("T")[0];

      // FILTRADO ESTRICTO: Solo traemos ventas exitosas (LeadClosures=Success)
      const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&AllClosedStatuses=true&LeadClosures=Success`;

      // USAMOS LA LÓGICA DE PAGINACIÓN AHORA
      const allLeads = await this.fetchAllPages(endpoint);

      console.log(`[EnreachAdapter] Fetched TOTAL ${allLeads.length} raw leads from API`);

      // FILTRO INTERNO: Solo procesamos leads que explícitamente tengan closure="Success"
      let filteredLeads = allLeads.filter((lead) => {
        const closure = this.getStr(lead, ["closure", "Closure"]);
        return closure && closure.toLowerCase() === "success";
      });

      console.log(
        `[EnreachAdapter] Filtered ${allLeads.length} raw leads down to ${filteredLeads.length} valid sales (closure=Success)`,
      );

      const dataFilters = this.config?.productExtraction?.dataFilters;
      if (dataFilters && dataFilters.length > 0) {
        const beforeCount = filteredLeads.length;
        filteredLeads = filteredLeads.filter((lead) => this.passesDataFilters(lead, dataFilters));
        console.log(`[EnreachAdapter] Data filters applied: ${beforeCount} -> ${filteredLeads.length} leads`);
      }

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
      }

      return filteredLeads.map((lead: HeroBaseLead) => this.mapLeadToSale(lead, mappingLookup));
    } catch (error) {
      console.error("[EnreachAdapter] Critical error in fetchSales:", error);
      return [];
    }
  }

  async fetchSalesRange(
    range: { from: string; to: string },
    campaignMappings?: CampaignMappingConfig[],
  ): Promise<StandardSale[]> {
    try {
      const fromStr = range.from.split("T")[0];
      const toStr = range.to.split("T")[0];
      console.log(`[EnreachAdapter] Fetching ONLY SUCCESS sales for range ${fromStr} -> ${toStr}`);

      // Solo intentamos el endpoint más específico con paginación
      const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${fromStr}&ModifiedTo=${toStr}&AllClosedStatuses=true&LeadClosures=Success`;

      const allLeads = await this.fetchAllPages(endpoint);

      console.log(`[EnreachAdapter] Fetched TOTAL ${allLeads.length} raw leads from API (range)`);

      let filteredLeads = allLeads.filter((lead) => {
        const closure = this.getStr(lead, ["closure", "Closure"]);
        return closure && closure.toLowerCase() === "success";
      });

      const dataFilters = this.config?.productExtraction?.dataFilters;
      if (dataFilters && dataFilters.length > 0) {
        const beforeCount = filteredLeads.length;
        filteredLeads = filteredLeads.filter((lead) => this.passesDataFilters(lead, dataFilters));
      }

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
      }

      return filteredLeads.map((lead: HeroBaseLead) => this.mapLeadToSale(lead, mappingLookup));
    } catch (error) {
      console.error("[EnreachAdapter] Critical error in fetchSalesRange:", error);
      return [];
    }
  }

  // Extraje la lógica de mapeo para no repetirla
  private mapLeadToSale(lead: HeroBaseLead, mappingLookup: Map<string, CampaignMappingConfig>): StandardSale {
    const externalId = this.getStr(lead, ["uniqueId", "UniqueId"]);
    const campaignObj = (lead.campaign || lead.Campaign) as Record<string, unknown> | undefined;
    const campaignId = campaignObj ? this.getStr(campaignObj, ["uniqueId", "UniqueId", "code"]) : "";

    // --- FIX: CAMPAIGN NAME DETECTION ---
    let campaignCode = campaignObj ? this.getStr(campaignObj, ["code", "Code"]) : "";
    const dataObj = (lead.data || lead.Data) as Record<string, unknown> | undefined;

    // Fallback: buscar en data.Kampagne si el objeto campaña no tiene nombre
    if ((!campaignCode || campaignCode.trim() === "") && dataObj) {
      campaignCode = this.getStr(dataObj, ["Kampagne", "kampagne", "CampaignName"]);
    }
    // Fallback final: usar ID
    if (!campaignCode || campaignCode.trim() === "") {
      campaignCode = campaignId || "Unknown Campaign";
    }

    const firstProcessedByUser = (lead.firstProcessedByUser || lead.FirstProcessedByUser) as
      | Record<string, unknown>
      | undefined;
    const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as
      | Record<string, unknown>
      | undefined;
    const agentOrgCode = (firstProcessedByUser?.orgCode as string) || (lastModifiedByUser?.orgCode as string) || "";

    let agentName = this.getStr(firstProcessedByUser, ["name", "Name", "fullName"]);
    if (!agentName) agentName = agentOrgCode;

    let customerName = "";
    let customerPhone = "";

    if (dataObj) {
      const firstName = this.getStr(dataObj, ["Navn1", "FirstName", "Fornavn"]);
      const lastName = this.getStr(dataObj, ["Navn2", "LastName", "Efternavn"]);
      customerName = [firstName, lastName].filter(Boolean).join(" ").trim();

      if (!customerName) {
        customerName = this.getStr(dataObj, ["Navn", "Name", "Company", "Firma"]);
      }

      customerPhone = this.getStr(dataObj, ["Telefon1", "Telefon", "Phone", "Mobile"]);
    }

    const products = this.extractProducts(lead, dataObj, campaignId, campaignCode);
    let externalReference: string | null = null;
    const mapping = mappingLookup.get(campaignId);

    if (mapping?.referenceConfig && dataObj) {
      externalReference = this.extractReference({ ...dataObj, ...lead }, mapping.referenceConfig);
    }

    if (!externalReference && dataObj) {
      externalReference =
        this.getStr(dataObj, [
          "OPP",
          "opp",
          "Opp",
          "OPP_number",
          "opp_number",
          "OppNumber",
          "OrderId",
          "orderId",
          "order_id",
          "OrdreId",
          "OrderNumber",
          "orderNumber",
        ]) || null;
    }

    if (!externalReference) {
      const allVariables = { ...dataObj, ...lead };
      externalReference = this.searchForOppInVariables(allVariables as Record<string, unknown>);
    }

    const saleDate = this.getStr(lead, ["firstProcessedTime", "lastModifiedTime"]) || new Date().toISOString();

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
      rawPayload: lead,
      metadata: {
        source: "enreach",
        campaignName: campaignCode,
        campaignId,
      },
    };
  }

  async fetchCallsRange(): Promise<StandardCall[]> {
    return [];
  }

  // --- LÓGICA DE EXTRACCIÓN DE PRODUCTOS ---
  private extractProducts(
    lead: HeroBaseLead,
    dataObj: Record<string, unknown> | undefined,
    campaignId: string,
    campaignCode: string,
  ): StandardProduct[] {
    const products: StandardProduct[] = [];
    const extractionConfig = this.config?.productExtraction;
    const strategy = extractionConfig?.strategy || "standard_closure";
    const validationKey = extractionConfig?.validationKey;

    if (validationKey && dataObj) {
      const validationValue = this.getValue(dataObj, [validationKey]);
      if (!validationValue) {
        return [];
      }
    }

    if (strategy === "conditional" && extractionConfig?.conditionalRules && dataObj) {
      for (const rule of extractionConfig.conditionalRules) {
        const conditionValue = this.getValue(dataObj, [rule.conditionKey]);
        if (!conditionValue) continue;
        if (rule.conditionValue && String(conditionValue) !== rule.conditionValue) continue;
        const extractedProducts = this.extractFromRule(rule, dataObj, lead);
        if (extractedProducts.length > 0) {
          products.push(...extractedProducts);
          break;
        }
      }
      if (products.length > 0) return products;
    }

    if (strategy === "data_keys_regex" && dataObj && extractionConfig?.regexPattern) {
      try {
        const regex = new RegExp(extractionConfig.regexPattern, "i");
        for (const [key, value] of Object.entries(dataObj)) {
          if (value && String(value).length > 0) {
            const match = key.match(regex);
            if (match) {
              const name = match[1]?.trim() || key;
              const priceStr = match[2]?.replace(",", ".") || "0";
              products.push({
                name: name,
                externalId: key,
                quantity: 1,
                unitPrice: parseFloat(priceStr),
              });
            }
          }
        }
      } catch (e) {
        console.error("[EnreachAdapter] Invalid regex:", e);
      }
    }

    if (strategy === "specific_fields" && dataObj && extractionConfig?.targetKeys) {
      for (const key of extractionConfig.targetKeys) {
        const val = this.getValue(dataObj, [key]);
        if (val && String(val).trim().length > 0) {
          products.push({
            name: String(val),
            externalId: String(val),
            quantity: 1,
            unitPrice: 0,
          });
        }
      }
    }

    const closureData = (lead.closureData || lead.ClosureData) as any[];
    if (products.length === 0 && Array.isArray(closureData) && closureData.length > 0) {
      for (const item of closureData) {
        products.push({
          name: item.text || item.productName || "Unknown",
          externalId: item.sku || item.id || "unknown",
          quantity: Number(item.amount || item.quantity || 1),
          unitPrice: Number(item.price || item.amount || 0),
        });
      }
    }

    if (products.length === 0) {
      const fallbackName = extractionConfig?.defaultName || campaignCode || "Venta General";
      products.push({
        name: fallbackName,
        externalId: campaignId || "unknown",
        quantity: 1,
        unitPrice: 0,
      });
    }

    return products;
  }

  private extractFromRule(
    rule: ConditionalExtractionRule,
    dataObj: Record<string, unknown>,
    lead: HeroBaseLead,
  ): StandardProduct[] {
    const products: StandardProduct[] = [];
    switch (rule.extractionType) {
      case "specific_fields":
        if (rule.targetKeys) {
          for (const key of rule.targetKeys) {
            const val = this.getValue(dataObj, [key]);
            if (val && String(val).trim().length > 0) {
              products.push({ name: String(val), externalId: key, quantity: 1, unitPrice: 0 });
            }
          }
        }
        break;
      case "regex":
        if (rule.regexPattern) {
          try {
            const regex = new RegExp(rule.regexPattern, "i");
            for (const [key, value] of Object.entries(dataObj)) {
              if (value && String(value).length > 0) {
                const keyMatch = key.match(regex);
                if (keyMatch) {
                  const name = keyMatch[1]?.trim() || key;
                  const priceStr = keyMatch[2]?.replace(",", ".") || "0";
                  products.push({ name: name, externalId: key, quantity: 1, unitPrice: parseFloat(priceStr) });
                } else {
                  const valMatch = String(value).match(regex);
                  if (valMatch) {
                    const name = valMatch[1]?.trim() || String(value);
                    const priceStr = valMatch[2]?.replace(",", ".") || "0";
                    products.push({ name: name, externalId: key, quantity: 1, unitPrice: parseFloat(priceStr) });
                  }
                }
              }
            }
          } catch (e) {
            console.error("[EnreachAdapter] Invalid regex in rule:", e);
          }
        }
        break;
      case "static_value":
        if (rule.staticProductName) {
          products.push({
            name: rule.staticProductName,
            externalId: rule.conditionKey,
            quantity: 1,
            unitPrice: rule.staticProductPrice || 0,
          });
        }
        break;
    }
    return products;
  }

  private extractReference(variables: Record<string, unknown>, config: ReferenceExtractionConfig): string | null {
    try {
      if (config.type === "field_id") {
        return this.getStr(variables, [config.value]);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  private searchForOppInVariables(variables: Record<string, unknown>): string | null {
    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === "string" && (key.toLowerCase().includes("opp") || key.toLowerCase().includes("order"))) {
        return value;
      }
    }
    return null;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  private passesDataFilters(lead: HeroBaseLead, filters: DataFilterRule[]): boolean {
    for (const filter of filters) {
      const fieldValue = this.getNestedValue(lead, filter.field);
      const strValue = fieldValue !== undefined && fieldValue !== null ? String(fieldValue) : "";
      const filterValue = filter.value;
      let passes = false;
      switch (filter.operator) {
        case "equals":
          passes = strValue.toLowerCase() === filterValue.toLowerCase();
          break;
        case "notEquals":
          passes = strValue.toLowerCase() !== filterValue.toLowerCase();
          break;
        case "contains":
          passes = strValue.toLowerCase().includes(filterValue.toLowerCase());
          break;
        case "notContains":
          passes = !strValue.toLowerCase().includes(filterValue.toLowerCase());
          break;
        case "startsWith":
          passes = strValue.toLowerCase().startsWith(filterValue.toLowerCase());
          break;
        case "endsWith":
          passes = strValue.toLowerCase().endsWith(filterValue.toLowerCase());
          break;
        case "regex":
          try {
            passes = new RegExp(filterValue, "i").test(strValue);
          } catch (e) {
            passes = false;
          }
          break;
        default:
          passes = true;
      }
      if (!passes) return false;
    }
    return true;
  }

  async fetchUsers(): Promise<StandardUser[]> {
    return [];
  }
  async fetchCampaigns(): Promise<StandardCampaign[]> {
    return [];
  }
  async fetchCalls(): Promise<StandardCall[]> {
    return [];
  }
}
