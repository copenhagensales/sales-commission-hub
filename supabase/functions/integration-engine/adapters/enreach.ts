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
  ExtractionCondition,
  DataFilterRule,
  DataFilterGroup,
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
      // Heuristic: if token contains ':', treat as user:pass for Basic Auth (matching enreach-data-app behavior)
      if (credentials.api_token.includes(':')) {
        const basicAuth = btoa(credentials.api_token);
        authHeader = `Basic ${basicAuth}`;
      } else {
        authHeader = `Bearer ${credentials.api_token}`;
      }
    } else {
      throw new Error("[EnreachAdapter] No valid credentials provided.");
    }

    this.headers = {
      Authorization: authHeader,
      Accept: "application/json",
      "X-Rate-Limit-Fair-Use-Policy": "Minute rated",
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

  // Helper para procesar páginas una por una SIN acumular todo en memoria
  // Con deduplicación automática por externalId
  private async processPageByPage(
    baseEndpoint: string,
    processor: (leads: HeroBaseLead[]) => StandardSale[],
    maxLeads = 50000
  ): Promise<StandardSale[]> {
    const allSales: StandardSale[] = [];
    const seenIds = new Set<string>(); // Deduplicación
    let skip = 0;
    const take = 500;
    let hasMore = true;
    let page = 1;
    let totalProcessed = 0;
    let duplicatesSkipped = 0;
    let lastFirstId: string | null = null;

    console.log(`[EnreachAdapter] Starting pagination on: ${baseEndpoint}`);

    while (hasMore && totalProcessed < maxLeads) {
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
          // Guardrail: algunos endpoints ignoran skip/take y devuelven siempre la misma página
          const firstAny = pageResults[0] as Record<string, unknown>;
          const firstId = this.getStr(firstAny, ["uniqueId", "UniqueId", "id", "Id"]);
          if (skip > 0 && lastFirstId && firstId && firstId === lastFirstId) {
            console.warn(`[EnreachAdapter] Pagination appears stuck (same firstId: ${firstId}). Stopping to avoid infinite loop.`);
            break;
          }
          if (firstId) lastFirstId = firstId;

          const pageSales = processor(pageResults);

          // Deduplicar: solo agregar ventas con externalId único
          let addedThisPage = 0;
          for (const sale of pageSales) {
            if (sale.externalId && !seenIds.has(sale.externalId)) {
              seenIds.add(sale.externalId);
              allSales.push(sale);
              addedThisPage++;
            } else if (sale.externalId) {
              duplicatesSkipped++;
            }
          }

          totalProcessed += pageResults.length;
          console.log(
            `[EnreachAdapter] Page ${page}: ${pageResults.length} leads -> ${addedThisPage} sales (Total: ${allSales.length}, Dups: ${duplicatesSkipped})`
          );

          if (pageResults.length < take || totalProcessed >= maxLeads) {
            hasMore = false;
          } else {
            skip += take;
            page++;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } else {
          hasMore = false;
        }
      } catch (e) {
        console.error(`[EnreachAdapter] Error fetching page ${page}:`, e);
        hasMore = false;
      }
    }

    if (duplicatesSkipped > 0) {
      console.log(`[EnreachAdapter] Total duplicates skipped: ${duplicatesSkipped}`);
    }
    if (totalProcessed >= maxLeads) {
      console.warn(`[EnreachAdapter] Reached max leads limit (${maxLeads}). Consider using smaller date ranges.`);
    }

    return allSales;
  }

  // Debug result type for storing raw data
  private lastDebugData: {
    rawLeads: Record<string, unknown>[];
    processedSales: StandardSale[];
    skipReasonMap: Map<string, string>;
  } | null = null;

  getLastDebugData() {
    return this.lastDebugData;
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      // IMPORTANTE: Limitar días para evitar OOM. Máximo 7 días por llamada.
      const effectiveDays = Math.min(days, 7);
      if (days > 7) {
        console.warn(`[EnreachAdapter] Requested ${days} days, limiting to ${effectiveDays} to prevent OOM`);
      }

      console.log(`[EnreachAdapter] Fetching leads for last ${effectiveDays} days (will filter closure=success client-side)`);
      console.log(`[EnreachAdapter] Dialer name: ${this.dialerName}`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - effectiveDays);
      const modifiedFrom = cutoffDate.toISOString().split("T")[0];
      const today = new Date().toISOString().split("T")[0];

      console.log(`[EnreachAdapter] Date range: ${modifiedFrom} to ${today}`);

      // NO usar LeadClosures=Success - filtrar client-side como hace el simulador
      const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&AllClosedStatuses=true`;

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
      }

      const dataFilters = this.config?.productExtraction?.dataFilters;
      const dataFilterGroups = this.config?.productExtraction?.dataFilterGroups;
      const dataFilterGroupsLogic = this.config?.productExtraction?.dataFilterGroupsLogic;

      // Log filter configuration
      console.log(`[EnreachAdapter] Data filters configured: ${JSON.stringify(dataFilters || [])}`);

      // Diagnostic counters
      let totalLeadsReceived = 0;
      let closureSuccessCount = 0;
      let filteredByDataFilters = 0;
      const rejectedByFilter: { agentEmail: string; closure: string; date: string }[] = [];
      const todayLeads: { agentEmail: string; closure: string; date: string }[] = [];

      // Store raw leads for debug
      const allRawLeads: Record<string, unknown>[] = [];
      const skipReasonMap = new Map<string, string>();

      // Procesador por página: filtrar closure=success client-side (igual que el simulador)
      const pageProcessor = (leads: HeroBaseLead[]): StandardSale[] => {
        totalLeadsReceived += leads.length;

        // Store ALL raw leads for debugging
        for (const lead of leads) {
          allRawLeads.push(lead as Record<string, unknown>);
        }

        // Log leads from today for diagnostics
        for (const lead of leads) {
          const modifiedTime = this.getStr(lead, ["lastModifiedTime", "firstProcessedTime"]);
          const leadDate = modifiedTime ? modifiedTime.split("T")[0] : "";
          const closure = this.getStr(lead, ["closure", "Closure"]);
          const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
          const agentEmail = lastModifiedByUser?.orgCode as string || "unknown";

          if (leadDate === today) {
            todayLeads.push({ agentEmail, closure, date: leadDate });
          }
        }

        // Filtrar solo closure=Success (case-insensitive)
        let filtered = leads.filter((lead) => {
          const closure = this.getStr(lead, ["closure", "Closure"]);
          const externalId = this.getStr(lead, ["uniqueId", "UniqueId"]);
          const isSuccess = closure && closure.toLowerCase() === "success";
          if (!isSuccess && externalId) {
            skipReasonMap.set(externalId, `closure_not_success:${closure}`);
          }
          return isSuccess;
        });
        closureSuccessCount += filtered.length;

        // Aplicar filtros de datos adicionales si existen
        if ((dataFilters && dataFilters.length > 0) || (dataFilterGroups && dataFilterGroups.length > 0)) {
          const beforeFilter = filtered.length;
          filtered = filtered.filter((lead) => {
            const externalId = this.getStr(lead, ["uniqueId", "UniqueId"]);
            const passes = this.passesDataFilters(lead, dataFilters || [], dataFilterGroups, dataFilterGroupsLogic);
            if (!passes) {
              const modifiedTime = this.getStr(lead, ["lastModifiedTime", "firstProcessedTime"]);
              const leadDate = modifiedTime ? modifiedTime.split("T")[0] : "";
              const closure = this.getStr(lead, ["closure", "Closure"]);
              const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
              const agentEmail = lastModifiedByUser?.orgCode as string || "unknown";
              rejectedByFilter.push({ agentEmail, closure, date: leadDate });
              if (externalId) {
                skipReasonMap.set(externalId, `data_filter:email=${agentEmail}`);
              }
            }
            return passes;
          });
          filteredByDataFilters += (beforeFilter - filtered.length);
        }

        return filtered.map((lead) => this.mapLeadToSale(lead, mappingLookup));
      };

      const results = await this.processPageByPage(endpoint, pageProcessor);

      // Store debug data for later retrieval
      this.lastDebugData = {
        rawLeads: allRawLeads,
        processedSales: results,
        skipReasonMap: skipReasonMap,
      };

      // Log diagnostic summary
      console.log(`[EnreachAdapter] ===== SYNC DIAGNOSTICS for ${this.dialerName} =====`);
      console.log(`[EnreachAdapter] Total leads from API: ${totalLeadsReceived}`);
      console.log(`[EnreachAdapter] Leads with closure=success: ${closureSuccessCount}`);
      console.log(`[EnreachAdapter] Filtered out by data filters: ${filteredByDataFilters}`);
      console.log(`[EnreachAdapter] Final sales count: ${results.length}`);
      console.log(`[EnreachAdapter] Debug data stored: ${allRawLeads.length} raw leads, ${skipReasonMap.size} skip reasons`);

      if (todayLeads.length > 0) {
        console.log(`[EnreachAdapter] Leads from TODAY (${today}): ${todayLeads.length}`);
        console.log(`[EnreachAdapter] Today's leads details: ${JSON.stringify(todayLeads.slice(0, 10))}`);
      } else {
        console.log(`[EnreachAdapter] NO leads found from TODAY (${today})`);
      }

      if (rejectedByFilter.length > 0) {
        console.log(`[EnreachAdapter] Sample rejected by filter (first 5): ${JSON.stringify(rejectedByFilter.slice(0, 5))}`);
      }
      console.log(`[EnreachAdapter] ===== END DIAGNOSTICS =====`);

      return results;
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
      console.log(`[EnreachAdapter] Fetching leads for range ${fromStr} -> ${toStr} (will filter closure=success client-side)`);

      // NO usar LeadClosures=Success - filtrar client-side como hace el simulador
      const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${fromStr}&ModifiedTo=${toStr}&AllClosedStatuses=true`;

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
      }

      const dataFilters = this.config?.productExtraction?.dataFilters;
      const dataFilterGroups = this.config?.productExtraction?.dataFilterGroups;
      const dataFilterGroupsLogic = this.config?.productExtraction?.dataFilterGroupsLogic;

      const pageProcessor = (leads: HeroBaseLead[]): StandardSale[] => {
        // Filtrar solo closure=Success (case-insensitive)
        let filtered = leads.filter((lead) => {
          const closure = this.getStr(lead, ["closure", "Closure"]);
          return closure && closure.toLowerCase() === "success";
        });

        if ((dataFilters && dataFilters.length > 0) || (dataFilterGroups && dataFilterGroups.length > 0)) {
          filtered = filtered.filter((lead) => this.passesDataFilters(lead, dataFilters || [], dataFilterGroups, dataFilterGroupsLogic));
        }

        return filtered.map((lead) => this.mapLeadToSale(lead, mappingLookup));
      };

      return await this.processPageByPage(endpoint, pageProcessor);
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
        // Check if rule conditions pass
        if (!this.checkExtractionRuleConditions(rule, dataObj, lead)) {
          continue;
        }
        const extractedProducts = this.extractFromRule(rule, dataObj, lead);
        if (extractedProducts.length > 0) {
          products.push(...extractedProducts);
          // Removed break to allow multiple matching rules
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
            // Check if the key contains template placeholders like {{field}}
            if (key.includes("{{") && key.includes("}}")) {
              // Process as a template (like composite type)
              let productName = key.replace(/\{\{([^}]+)\}\}/g, (_, fieldKey) => {
                const trimmedKey = fieldKey.trim();
                let val = this.getNestedValue(lead, trimmedKey);
                if (val === undefined || val === null) {
                  val = this.getNestedValue(dataObj, trimmedKey);
                }
                if (val === undefined || val === null) {
                  val = this.getValue(dataObj, [trimmedKey]);
                }
                return val ? String(val) : "";
              });
              // Clean up extra spaces from empty values
              productName = productName.replace(/\s+-\s*$/g, "").replace(/^\s*-\s+/g, "").trim();
              if (productName && productName.length > 0) {
                products.push({ name: productName, externalId: productName, quantity: 1, unitPrice: 0 });
              }
            } else {
              // Original behavior: look up the field value directly
              const val = this.getValue(dataObj, [key]);
              if (val && String(val).trim().length > 0) {
                const productName = String(val).trim();
                products.push({ name: productName, externalId: productName, quantity: 1, unitPrice: 0 });
              }
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
          // FIX: Use product name as externalId instead of conditionKey
          products.push({
            name: rule.staticProductName,
            externalId: rule.staticProductName,
            quantity: 1,
            unitPrice: rule.staticProductPrice || 0,
          });
        }
        break;
      case "composite":
        if ((rule as any).productNameTemplate) {
          let name = String((rule as any).productNameTemplate);
          // Regex que captura todo el contenido entre {{ }} incluyendo guiones, espacios, etc.
          name = name.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
            const trimmedKey = key.trim();
            // Usar getNestedValue para soportar notación de punto (e.g., campaign.code)
            // Buscar primero en el lead completo, luego en dataObj
            let val = this.getNestedValue(lead, trimmedKey);
            if (val === undefined || val === null) {
              val = this.getNestedValue(dataObj, trimmedKey);
            }
            if (val === undefined || val === null) {
              val = this.getValue(dataObj, [trimmedKey]);
            }
            return val ? String(val) : "";
          });
          // Limpiar espacios extra resultantes de valores vacíos
          name = name.replace(/\s+-\s*$/g, "").replace(/^\s*-\s+/g, "").trim();
          if (name && name.length > 0) {
            // FIX: Use product name as externalId instead of conditionKey
            products.push({
              name: name,
              externalId: name,
              quantity: 1,
              unitPrice: 0,
            });
          }
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

  // Check if a single rule passes
  private checkRule(lead: HeroBaseLead, rule: DataFilterRule): boolean {
    let fieldValue = this.getNestedValue(lead, rule.field);

    // Fallback: try to find field in lead.data.* if not found at root
    const dataObj = (lead.data || lead.Data) as Record<string, unknown> | undefined;
    if ((fieldValue === undefined || fieldValue === null || fieldValue === "") && dataObj && !rule.field.startsWith("data.")) {
      fieldValue = this.getNestedValue(dataObj, rule.field);
    }

    const fieldExists = fieldValue !== undefined;

    // Compat: "agentEmail" maps to orgCode fields
    if ((fieldValue === undefined || fieldValue === null || fieldValue === "") && rule.field === "agentEmail") {
      fieldValue =
        this.getNestedValue(lead, "firstProcessedByUser.orgCode") ??
        this.getNestedValue(lead, "FirstProcessedByUser.orgCode") ??
        this.getNestedValue(lead, "lastModifiedByUser.orgCode") ??
        this.getNestedValue(lead, "LastModifiedByUser.orgCode");
    }

    // Handle existence/empty checks first
    switch (rule.operator) {
      case "notExists":
        return !fieldExists;
      case "isEmpty":
        return !fieldExists || fieldValue === null || fieldValue === "";
      case "isNotEmpty":
        return fieldExists && fieldValue !== null && fieldValue !== "";
    }

    const strValue = fieldValue !== undefined && fieldValue !== null ? String(fieldValue) : "";
    const filterValue = rule.value || "";

    switch (rule.operator) {
      case "equals":
        return strValue.toLowerCase() === filterValue.toLowerCase();
      case "notEquals":
        return strValue.toLowerCase() !== filterValue.toLowerCase();
      case "contains":
        return strValue.toLowerCase().includes(filterValue.toLowerCase());
      case "notContains":
        return !strValue.toLowerCase().includes(filterValue.toLowerCase());
      case "startsWith":
        return strValue.toLowerCase().startsWith(filterValue.toLowerCase());
      case "endsWith":
        return strValue.toLowerCase().endsWith(filterValue.toLowerCase());
      case "regex":
        try {
          return new RegExp(filterValue, "i").test(strValue);
        } catch {
          return false;
        }
      default:
        return true;
    }
  }

  // Check if a filter group passes (rules combined with AND or OR)
  private checkFilterGroup(lead: HeroBaseLead, group: DataFilterGroup): boolean {
    if (!group.rules || group.rules.length === 0) return true;

    if (group.logic === "OR") {
      // OR: at least one rule must pass
      return group.rules.some((rule) => this.checkRule(lead, rule));
    } else {
      // AND (default): all rules must pass
      return group.rules.every((rule) => this.checkRule(lead, rule));
    }
  }

  private passesDataFilters(lead: HeroBaseLead, filters: DataFilterRule[], groups?: DataFilterGroup[], groupsLogic?: 'AND' | 'OR'): boolean {
    // FIRST: Check legacy filters (these are always AND, must ALL pass)
    if (filters && filters.length > 0) {
      const passesLegacy = filters.every((rule) => this.checkRule(lead, rule));
      if (!passesLegacy) return false;
    }

    // THEN: If we have new-style filter groups, also check those
    if (groups && groups.length > 0) {
      const logic = groupsLogic || 'AND';
      if (logic === "OR") {
        // OR: at least one group must pass
        return groups.some((group) => this.checkFilterGroup(lead, group));
      } else {
        // AND (default): all groups must pass
        return groups.every((group) => this.checkFilterGroup(lead, group));
      }
    }

    return true;
  }

  // Check if extraction rule conditions pass (supports both legacy single condition and new multiple conditions)
  private checkExtractionRuleConditions(
    rule: ConditionalExtractionRule,
    dataObj: Record<string, unknown>,
    lead: HeroBaseLead,
  ): boolean {
    // NEW: If rule has conditions array, use those with boolean logic
    if (rule.conditions && rule.conditions.length > 0) {
      const logic = rule.conditionsLogic || 'AND';

      const checkCondition = (condition: ExtractionCondition): boolean => {
        // Try to get value from dataObj first, then from lead root
        let fieldValue = this.getValue(dataObj, [condition.field]);
        if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
          fieldValue = this.getNestedValue(lead, condition.field);
        }

        const fieldExists = fieldValue !== undefined && fieldValue !== null;

        // Handle existence/empty checks
        switch (condition.operator) {
          case "notExists":
            return !fieldExists;
          case "isEmpty":
            return !fieldExists || fieldValue === "";
          case "isNotEmpty":
            return fieldExists && fieldValue !== "";
        }

        const strValue = fieldExists ? String(fieldValue) : "";
        const condValue = condition.value || "";

        switch (condition.operator) {
          case "equals":
            return strValue.toLowerCase() === condValue.toLowerCase();
          case "notEquals":
            return strValue.toLowerCase() !== condValue.toLowerCase();
          case "contains":
            return strValue.toLowerCase().includes(condValue.toLowerCase());
          case "notContains":
            return !strValue.toLowerCase().includes(condValue.toLowerCase());
          case "startsWith":
            return strValue.toLowerCase().startsWith(condValue.toLowerCase());
          case "endsWith":
            return strValue.toLowerCase().endsWith(condValue.toLowerCase());
          case "regex":
            try {
              return new RegExp(condValue, "i").test(strValue);
            } catch {
              return false;
            }
          default:
            return true;
        }
      };

      if (logic === 'OR') {
        return rule.conditions.some(checkCondition);
      } else {
        return rule.conditions.every(checkCondition);
      }
    }

    // LEGACY: Single conditionKey/conditionValue (backward compatible)
    if (rule.conditionKey) {
      const conditionValue = this.getValue(dataObj, [rule.conditionKey]);
      if (!conditionValue) return false;
      if (rule.conditionValue && String(conditionValue) !== rule.conditionValue) return false;
      return true;
    }

    // No conditions = always pass (useful for catch-all rules)
    return true;
  }

  /**
   * Fetch users from Enreach API
   * Enreach doesn't have a dedicated /users endpoint, so we extract unique users from leads data
   */
  async fetchUsers(): Promise<StandardUser[]> {
    try {
      console.log(`[EnreachAdapter] Fetching users from leads data...`);

      // Fetch recent leads to extract unique users - use 7 days for faster extraction
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 7);
      const modifiedFrom = cutoffDate.toISOString().split("T")[0];

      const endpoint = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&AllClosedStatuses=true`;

      const userMap = new Map<string, StandardUser>();
      let skip = 0;
      const take = 1000; // Larger batch size for efficiency
      let hasMore = true;
      let page = 1;

      while (hasMore && page <= 10) { // Max 10,000 leads for user extraction
        const separator = endpoint.includes("?") ? "&" : "?";
        const pagedEndpoint = `${endpoint}${separator}skip=${skip}&take=${take}`;

        try {
          const data = (await this.get(pagedEndpoint)) as unknown;
          let pageResults: HeroBaseLead[] = [];

          if (Array.isArray(data)) {
            pageResults = data as HeroBaseLead[];
          } else if (data && typeof data === "object") {
            const wrapper = data as Record<string, unknown>;
            pageResults = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || []) as HeroBaseLead[];
          }

          if (pageResults.length === 0) {
            hasMore = false;
            continue;
          }

          // Extract unique users from this page
          for (const lead of pageResults) {
            const firstProcessedByUser = (lead.firstProcessedByUser || lead.FirstProcessedByUser) as Record<string, unknown> | undefined;
            const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;

            // Process firstProcessedByUser
            if (firstProcessedByUser) {
              const orgCode = this.getStr(firstProcessedByUser, ["orgCode", "OrgCode"]);
              if (orgCode && orgCode.includes("@") && !userMap.has(orgCode)) {
                const name = this.getStr(firstProcessedByUser, ["name", "Name", "fullName", "FullName"]) || orgCode.split("@")[0];
                userMap.set(orgCode, {
                  externalId: orgCode,
                  name: name,
                  email: orgCode,
                  isActive: true,
                });
              }
            }

            // Process lastModifiedByUser
            if (lastModifiedByUser) {
              const orgCode = this.getStr(lastModifiedByUser, ["orgCode", "OrgCode"]);
              if (orgCode && orgCode.includes("@") && !userMap.has(orgCode)) {
                const name = this.getStr(lastModifiedByUser, ["name", "Name", "fullName", "FullName"]) || orgCode.split("@")[0];
                userMap.set(orgCode, {
                  externalId: orgCode,
                  name: name,
                  email: orgCode,
                  isActive: true,
                });
              }
            }
          }

          if (pageResults.length < take) {
            hasMore = false;
          } else {
            skip += take;
            page++;
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        } catch (e) {
          console.error(`[EnreachAdapter] Error fetching page ${page} for users:`, e);
          hasMore = false;
        }
      }

      const users = Array.from(userMap.values());
      console.log(`[EnreachAdapter] Extracted ${users.length} unique users from leads`);
      return users;
    } catch (error) {
      console.error("[EnreachAdapter] Error fetching users:", error);
      return [];
    }
  }

  async fetchCalls(days: number): Promise<StandardCall[]> {
    const allCalls: StandardCall[] = [];
    const seenIds = new Set<string>();

    console.log(`[EnreachAdapter] Starting daily loop for last ${days} days...`);

    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];

      console.log(`[EnreachAdapter] Day-by-day fetch: Processing day ${dayStr} (${i} days ago)`);
      // Start of day to end of day
      const dailyCalls = await this.fetchCallsRange({
        from: `${dayStr}T00:00:00Z`,
        to: `${dayStr}T23:59:59Z`
      });

      let addedCount = 0;
      for (const call of dailyCalls) {
        if (!seenIds.has(call.externalId)) {
          seenIds.add(call.externalId);
          allCalls.push(call);
          addedCount++;
        }
      }
      console.log(`[EnreachAdapter] Finished day ${dayStr}: Added ${addedCount} new calls. Total: ${allCalls.length}`);

      if (i > 0) await new Promise(r => setTimeout(r, 1000));
    }

    return allCalls;
  }

  async fetchCallsRange(range: { from: string; to: string }): Promise<StandardCall[]> {
    console.log(`[EnreachAdapter] Starting call fetch session with chunked approach...`);

    // 1. Diagnostic/Auto-detection: Try to get OrgCode if not present
    try {
      const accountInfo: any = await this.get("/myaccount");
      console.log(`[EnreachAdapter] /myaccount response: ${JSON.stringify(accountInfo)}`);

      if (accountInfo && accountInfo.OrgCode) {
        // Fix: If OrgCode is set to an email (common config error) or missing, use the one from API
        if (!this.orgCode || this.orgCode.includes('@') || this.orgCode !== accountInfo.OrgCode) {
          console.log(`[EnreachAdapter] Auto-detected correct OrgCode: ${accountInfo.OrgCode} (was configured as: ${this.orgCode})`);
          this.orgCode = accountInfo.OrgCode;
        }
      }

      // Fallback FORCE: If it STILL contains @ (implies /myaccount also returned an email or failed to clarify), force 'Salg'
      if (this.orgCode && this.orgCode.includes('@')) {
        console.warn(`[EnreachAdapter] OrgCode '${this.orgCode}' appears to be an email. Forcing fallback to 'Salg' as per standard configuration.`);
        this.orgCode = 'Salg';
      }
    } catch (err) {
      console.warn(`[EnreachAdapter] Diagnostic /myaccount check failed. Continuing anyway. Error: ${err}`);
      // Fallback on error if bad config
      if (this.orgCode && this.orgCode.includes('@')) {
        this.orgCode = 'Salg';
      }
    }

    if (!this.orgCode) {
      console.warn(`[EnreachAdapter] No OrgCode available. Call fetching may fail.`);
    }

    // 2. Parse date range
    const startDate = new Date(range.from);
    const endDate = new Date(range.to);

    console.log(`[EnreachAdapter] Fetching calls from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // 3. Generate all days in the range
    const days: string[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      days.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[EnreachAdapter] Processing ${days.length} day(s) in chunks of 2 hours...`);

    // 4. Fetch calls for each day using chunked approach
    const allCalls: StandardCall[] = [];
    const seenIds = new Set<string>();
    let totalChunks = 0;
    let totalCallsFetched = 0;

    for (const day of days) {
      console.log(`[EnreachAdapter] Processing day: ${day}`);

      // Divide each day into 2-hour chunks (12 chunks per day)
      const chunks: { startTime: string; timeSpan: string }[] = [];
      for (let hour = 0; hour < 24; hour += 2) {
        const startTime = `${day}T${String(hour).padStart(2, '0')}:00:00Z`;
        chunks.push({ startTime, timeSpan: 'PT2H' }); // PT2H = 2 hours in ISO 8601 duration format
      }

      // Fetch each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        totalChunks++;

        console.log(`[EnreachAdapter] [Chunk ${i + 1}/${chunks.length}] Fetching calls from ${chunk.startTime}...`);

        try {
          const chunkCalls = await this.fetchCallsChunk(chunk.startTime, chunk.timeSpan);

          // Deduplicate by uniqueId
          let newCalls = 0;
          for (const call of chunkCalls) {
            if (!seenIds.has(call.externalId)) {
              seenIds.add(call.externalId);
              allCalls.push(call);
              newCalls++;
            }
          }

          totalCallsFetched += chunkCalls.length;
          console.log(`[EnreachAdapter]   -> Retrieved ${chunkCalls.length} calls (${newCalls} unique)`);

          // Small delay to avoid rate limiting
          if (i < chunks.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`[EnreachAdapter] Error fetching chunk ${chunk.startTime}:`, error);
          // Continue with next chunk even if this one fails
        }
      }

      console.log(`[EnreachAdapter] Completed day ${day}: Total unique calls so far: ${allCalls.length}`);
    }

    console.log(`[EnreachAdapter] ===== CALL FETCH SUMMARY =====`);
    console.log(`[EnreachAdapter] Total chunks processed: ${totalChunks}`);
    console.log(`[EnreachAdapter] Total calls fetched: ${totalCallsFetched}`);
    console.log(`[EnreachAdapter] Unique calls after deduplication: ${allCalls.length}`);
    console.log(`[EnreachAdapter] Duplicates removed: ${totalCallsFetched - allCalls.length}`);
    console.log(`[EnreachAdapter] ==============================`);

    return allCalls;
  }

  /**
   * Helper method to fetch a single chunk of calls
   */
  private async fetchCallsChunk(startTime: string, timeSpan: string): Promise<StandardCall[]> {


    // Format startTime for Herobase API - keep ISO format (as per working reference)
    const formattedStartTime = startTime;

    // NOTE: validation against enreach-data-app reference
    const orgParam = this.orgCode ? this.orgCode.trim() : 'Salg';
    const endpoint = `/calls?OrgCode=${orgParam}&StartTime=${encodeURIComponent(formattedStartTime)}&TimeSpan=${encodeURIComponent(timeSpan)}&Limit=5000`;
    console.log(`[EnreachAdapter] Requesting URL: ${this.baseUrl}${endpoint}`);

    try {
      const data = await this.get(endpoint);

      if (Array.isArray(data) && data.length > 0) {
        return this.mapCdrsToStandardCalls(data);
      } else if (Array.isArray(data)) {
        // Empty array is valid, just no calls in this chunk
        return [];
      } else {
        console.warn(`[EnreachAdapter] Unexpected response format from ${endpoint}`);
        return [];
      }
    } catch (error) {
      console.error(`[EnreachAdapter] Error fetching chunk:`, error);
      return [];
    }
  }

  private mapCdrsToStandardCalls(records: any[]): StandardCall[] {
    return records.map(r => {
      // Determine status
      let status: StandardCall['status'] = 'OTHER';
      const result = (r.Result || r.result || '').toLowerCase();

      if (result === 'answered' || result === 'connected' || r.IsAnswered) status = 'ANSWERED';
      else if (result === 'busy') status = 'BUSY';
      else if (result === 'noanswer' || result === 'no answer' || result === 'no_answer') status = 'NO_ANSWER';
      else if (result === 'failed') status = 'FAILED';

      // Map to StandardCall
      return {
        externalId: String(r.uniqueId || r.UniqueId || r.Id || r.id || r.CallId),
        integrationType: 'enreach',
        dialerName: this.dialerName,
        startTime: r.StartTime || r.startTime || r.Time || new Date().toISOString(),
        endTime: r.EndTime || r.endTime || r.StartTime || r.startTime || new Date().toISOString(),
        durationSeconds: Number(r.DurationTotalSeconds || r.duration || r.Duration || 0),
        totalDurationSeconds: Number(r.DurationTotalSeconds || r.duration || r.Duration || 0),
        status: status,
        agentExternalId: String(r.UserId || r.User?.Id || r.agentId || r.AgentId || 'unknown'),
        campaignExternalId: String(r.CampaignId || r.Campaign?.Id || r.ProjectUniqueId || 'unknown'),
        leadExternalId: String(r.LeadId || r.Lead?.Id || r.LeadUniqueId || 'unknown'),
        metadata: {
          project: r.ProjectName || r.Campaign?.Name,
          result: r.Result || r.Closure,
          number: r.PhoneNumber || r.Phone,
          orgCode: this.orgCode
        }
      };
    });
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    return [];
  }
}
