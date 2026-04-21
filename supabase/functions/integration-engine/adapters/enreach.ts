import { DialerAdapter, ApiMetrics } from "./interface.ts";
import {
  StandardSale,
  StandardUser,
  StandardCampaign,
  StandardProduct,
  StandardCall,
  StandardSession,
  CampaignMappingConfig,
  ReferenceExtractionConfig,
  DialerIntegrationConfig,
  ConditionalExtractionRule,
  ExtractionCondition,
  DataFilterRule,
  DataFilterGroup,
} from "../types.ts";
import { enreachToUTC } from "../../_shared/enreach-timezone.ts";

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
  private callsOrgCodes: string[] | null;
  private _metrics: ApiMetrics = { apiCalls: 0, rateLimitHits: 0, retries: 0 };

  // orgCode → { email, name } cache populated on demand from /users
  // when config.enableUserPreFetch === true (currently only Alka).
  private userOrgCodeMap: Map<string, { email: string; name: string }> | null = null;
  private userMapFetched = false;

  // Default whitelist (preserves existing behaviour for Tryg/Eesy/ASE/Adversus/Relatel/Lovablecph).
  private static readonly DEFAULT_AGENT_DOMAINS = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
  private static readonly WHITELISTED_EMAILS = ["kongtelling@gmail.com", "rasmusventura700@gmail.com"];

  private getAllowedDomains(): string[] {
    const override = this.config?.allowedAgentEmailDomains;
    return override && override.length > 0 ? override.map(d => d.toLowerCase()) : EnreachAdapter.DEFAULT_AGENT_DOMAINS;
  }

  private isValidSyncEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    const emailLower = email.toLowerCase();
    if (EnreachAdapter.WHITELISTED_EMAILS.includes(emailLower)) return true;
    return this.getAllowedDomains().some(domain => emailLower.endsWith(domain));
  }

  /**
   * Pre-fetch /users to build orgCode → email map.
   * Only runs when config.enableUserPreFetch === true (Alka).
   * Cached for the lifetime of the adapter instance (one sync run).
   */
  private async ensureUserOrgCodeMap(): Promise<void> {
    if (this.userMapFetched) return;
    this.userMapFetched = true;
    if (!this.config?.enableUserPreFetch) return;

    try {
      console.log(`[EnreachAdapter] enableUserPreFetch=true → pre-fetching /users for orgCode→email map`);
      const data = await this.get(`/users?Limit=2000`) as unknown;
      const users = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
      const map = new Map<string, { email: string; name: string }>();
      for (const u of users) {
        const orgCode = (u.orgCode as string) || "";
        const email = (u.email as string) || "";
        const name = (u.name as string) || (u.username as string) || "";
        if (orgCode && email) map.set(orgCode, { email, name });
      }
      this.userOrgCodeMap = map;
      console.log(`[EnreachAdapter] User pre-fetch complete: ${map.size} orgCode→email mappings`);
    } catch (e) {
      console.error(`[EnreachAdapter] User pre-fetch failed:`, e);
      this.userOrgCodeMap = new Map();
    }
  }

  getMetrics(): ApiMetrics { return { ...this._metrics }; }
  resetMetrics(): void { this._metrics = { apiCalls: 0, rateLimitHits: 0, retries: 0 }; }

  constructor(credentials: EnreachCredentials, dialerName?: string, config?: DialerIntegrationConfig | null, callsOrgCodes?: string[] | null) {
    let providedUrl = credentials.api_url || "https://wshero01.herobase.com/api";
    
    // Sanitize URL: remove common prefixes like "Web: ", "URL: ", "API: " that users may accidentally include
    const originalUrl = providedUrl;
    providedUrl = providedUrl.replace(/^(Web|URL|API|Endpoint):\s*/i, '').trim();
    
    // Ensure URL starts with https://
    if (!providedUrl.startsWith('http://') && !providedUrl.startsWith('https://')) {
      providedUrl = 'https://' + providedUrl;
    }
    
    if (originalUrl !== providedUrl) {
      console.log(`[EnreachAdapter] URL sanitized: "${originalUrl}" -> "${providedUrl}"`);
    }
    
    this.baseUrl = providedUrl.endsWith("/") ? providedUrl.slice(0, -1) : providedUrl;
    if (!this.baseUrl.endsWith("/api")) {
      this.baseUrl = this.baseUrl + "/api";
    }

    this.dialerName = dialerName || "Enreach";
    this.orgCode = credentials.org_code || null;
    this.config = config || null;
    this.callsOrgCodes = callsOrgCodes || null;

    console.log(`[EnreachAdapter] Config loaded: ${JSON.stringify(this.config?.productExtraction || "None")}`);
    console.log(`[EnreachAdapter] Calls org codes: ${JSON.stringify(this.callsOrgCodes || "None (will use default)")}`);

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

  /**
   * Fetch Enreach account rate limit info directly from the API.
   * Calls /api/myaccount/request/limits and /api/myaccount/request/counts
   */
  async fetchRateLimits(): Promise<{ limits: unknown; counts: unknown }> {
    const [limits, counts] = await Promise.all([
      this.get("/myaccount/request/limits").catch(e => ({ error: String(e) })),
      this.get("/myaccount/request/counts").catch(e => ({ error: String(e) })),
    ]);
    return { limits, counts };
  }

  /**
   * Returns true if this integration uses the /leads endpoint (ASE)
   * instead of /simpleleads (Eesy, Tryg, etc.)
   */
  private get usesLeadsEndpoint(): boolean {
    return this.dialerName.toLowerCase() === "ase";
  }

  /**
   * Build the correct leads list endpoint based on the integration.
   * ASE uses /leads?SearchName=cphsales2&Include=data,campaign,...
   * Other Enreach integrations use /simpleleads?Projects=*
   */
  private buildLeadsEndpoint(modifiedFrom: string, modifiedTo?: string): string {
    if (this.usesLeadsEndpoint) {
      let ep = `/leads?SearchName=cphsales2&ModifiedFrom=${modifiedFrom}&Include=data,campaign,lastModifiedByUser,firstProcessedByUser`;
      if (modifiedTo) ep += `&ModifiedTo=${modifiedTo}`;
      return ep;
    }
    let ep = `/simpleleads?Projects=*&ModifiedFrom=${modifiedFrom}&AllClosedStatuses=true`;
    if (modifiedTo) ep += `&ModifiedTo=${modifiedTo}`;
    return ep;
  }

  /** Fetch all projects accessible to this API user */
  async fetchAccessibleProjects(): Promise<{ uniqueId: string; name: string; active: boolean }[]> {
    const url = `${this.baseUrl}/projects`;
    console.log(`[EnreachAdapter] Fetching accessible projects: ${url}`);
    try {
      this._metrics.apiCalls++;
      const res = await fetch(url, { headers: this.headers });
      if (res.status === 429) {
        this._metrics.rateLimitHits++;
      }
      if (!res.ok) {
        console.warn(`[EnreachAdapter] /projects returned ${res.status}`);
        return [];
      }
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.Results || data.results || data.Projects || data.projects || []);
      console.log(`[EnreachAdapter] Accessible projects: ${arr.length} – ${arr.map((p: any) => p.Name || p.name).join(", ")}`);
      return arr.map((p: any) => ({
        uniqueId: String(p.UniqueId || p.uniqueId || p.Id || p.id || ""),
        name: String(p.Name || p.name || ""),
        active: Boolean(p.Active ?? p.active ?? true),
      }));
    } catch (e) {
      console.error(`[EnreachAdapter] fetchAccessibleProjects error:`, e);
      return [];
    }
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

  private addJitter(delayMs: number): number {
    const jitterFactor = 0.3; // ±30%
    const randomOffset = (Math.random() * 2 - 1) * jitterFactor;
    return Math.max(500, Math.round(delayMs * (1 + randomOffset)));
  }

  private async get(endpoint: string): Promise<unknown> {
    const url = `${this.baseUrl}${endpoint}`;
    const maxRetries = 2;

    // Proactive gating: stop early if we know quota is nearly exhausted
    if (this._metrics.rateLimitRemaining !== undefined && this._metrics.rateLimitRemaining < 50) {
      const msg = `RATE_LIMIT_EXHAUSTED: Only ${this._metrics.rateLimitRemaining} calls remaining (threshold: 50). Stopping proactively to preserve quota.`;
      console.warn(`[EnreachAdapter] ${msg}`);
      throw new Error(msg);
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      this._metrics.apiCalls++;

      const response = await fetch(url, { method: "GET", headers: this.headers });

      // Capture rate-limit headers from every response
      const rlLimit = response.headers.get("X-Rate-Limit-Limit");
      const rlRemaining = response.headers.get("X-Rate-Limit-Remaining");
      const rlReset = response.headers.get("X-Rate-Limit-Reset");
      if (rlLimit || rlRemaining || response.status === 429) {
        const info = { limit: rlLimit, remaining: rlRemaining, reset: rlReset, status: response.status, endpoint };
        console.log(`[EnreachAdapter] Rate-limit headers: ${JSON.stringify(info)}`);
        // Store latest values in metrics for sync-run logging
        if (rlLimit) this._metrics.rateLimitDailyLimit = parseInt(rlLimit, 10);
        if (rlRemaining) this._metrics.rateLimitRemaining = parseInt(rlRemaining, 10);
        if (rlReset) this._metrics.rateLimitReset = parseInt(rlReset, 10);
      }

      if (response.status === 429) {
        this._metrics.rateLimitHits++;
        if (attempt < maxRetries) {
          this._metrics.retries++;
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
          // Exponential backoff: 3s, 6s with jitter (capped at 15s)
          const exponentialDelay = 3000 * Math.pow(2, attempt);
          const baseDelay = !isNaN(retryAfterSec) && retryAfterSec > 0 
            ? retryAfterSec * 1000 
            : exponentialDelay;
          const delay = this.addJitter(Math.min(baseDelay, 15000));
          console.warn(`[EnreachAdapter] 429 Rate limited on ${endpoint}. Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[EnreachAdapter] API Error ${response.status}: ${errorText.substring(0, 200)}`);
        throw new Error(`Enreach API error: ${response.status}`);
      }

      return response.json();
    }

    throw new Error(`Enreach API error: max retries exceeded for ${endpoint}`);
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

  /**
   * Lightweight raw sales fetch for field sampling.
   * Skips complex filtering and pagination to be fast (~2-3 seconds).
   */
  async fetchSalesRaw(limit: number = 20): Promise<Record<string, unknown>[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const modifiedFrom = cutoffDate.toISOString().split("T")[0];
    
    // Simple fetch with limit - no complex filtering or pagination
    const endpoint = `${this.buildLeadsEndpoint(modifiedFrom)}&take=${limit}`;
    
    try {
      const data = await this.get(endpoint);
      let leads: Record<string, unknown>[] = [];
      
      if (Array.isArray(data)) {
        leads = data as Record<string, unknown>[];
      } else if (data && typeof data === "object") {
        const wrapper = data as Record<string, unknown>;
        leads = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || []) as Record<string, unknown>[];
      }
      
      console.log(`[EnreachAdapter] fetchSalesRaw: Retrieved ${leads.length} raw leads (limit: ${limit})`);
      return leads.slice(0, limit);
    } catch (error) {
      console.error("[EnreachAdapter] Error in fetchSalesRaw:", error);
      return [];
    }
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    try {
      // Pre-fetch /users → orgCode map when enabled (Alka). No-op for other tenants.
      await this.ensureUserOrgCodeMap();

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
      const endpoint = this.buildLeadsEndpoint(modifiedFrom);

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

          // Search for specific phone number
          const PHONE_SEARCH = "51806520";
          const leadStr = JSON.stringify(lead);
          if (leadStr.includes(PHONE_SEARCH)) {
            const closure = this.getStr(lead, ["closure", "Closure"]);
            const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
            const agentEmail = lastModifiedByUser?.orgCode as string || "unknown";
            const campaignObj = (lead.campaign || lead.Campaign) as Record<string, unknown> | undefined;
            const campaignCode = campaignObj ? this.getStr(campaignObj, ["code", "Code"]) : "unknown";
            console.log(`[EnreachAdapter] *** PHONE ${PHONE_SEARCH} FOUND in raw data! closure=${closure}, agent=${agentEmail}, campaign=${campaignCode}`);
          }
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

        // Map leads to sales, then filter by valid email
        const mappedSales = filtered.map((lead) => this.mapLeadToSale(lead, mappingLookup));
        
        // Filter out sales with invalid/missing email using whitelist (per-integration override)
        const validSales = mappedSales.filter(sale => {
          if (!this.isValidSyncEmail(sale.agentEmail)) {
            const externalId = sale.externalId;
            if (externalId) {
              skipReasonMap.set(externalId, `invalid_email:${sale.agentEmail || 'empty'}`);
            }
            return false;
          }
          return true;
        });
        
        return validSales;
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
      console.log(`[EnreachAdapter] Final sales count (after email whitelist): ${results.length}`);
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
      // Pre-fetch /users → orgCode map when enabled (Alka). No-op for other tenants.
      await this.ensureUserOrgCodeMap();

      const fromStr = range.from.split("T")[0];
      // Bump toStr by +1 day because HeroBase treats ModifiedTo as exclusive
      const toDate = new Date(range.to);
      toDate.setUTCDate(toDate.getUTCDate() + 1);
      const toStr = toDate.toISOString().split("T")[0];
      console.log(`[EnreachAdapter] Fetching leads for range ${fromStr} -> ${toStr} (ModifiedTo bumped +1d for exclusive API, will filter closure=success client-side)`);

      const endpoint = this.buildLeadsEndpoint(fromStr, toStr);

      const mappingLookup = new Map<string, CampaignMappingConfig>();
      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          mappingLookup.set(mapping.adversusCampaignId, mapping);
        }
      }

      const dataFilters = this.config?.productExtraction?.dataFilters;
      const dataFilterGroups = this.config?.productExtraction?.dataFilterGroups;
      const dataFilterGroupsLogic = this.config?.productExtraction?.dataFilterGroupsLogic;

      // Diagnostic counters
      let totalLeadsReceived = 0;
      let closureSuccessCount = 0;
      let filteredByDataFilters = 0;
      let filteredByEmail = 0;

      // Store raw leads for debug
      const allRawLeads: Record<string, unknown>[] = [];
      const skipReasonMap = new Map<string, string>();

      const PHONE_SEARCH = "51806520";

      const pageProcessor = (leads: HeroBaseLead[]): StandardSale[] => {
        totalLeadsReceived += leads.length;

        // Store ALL raw leads for debugging
        for (const lead of leads) {
          allRawLeads.push(lead as Record<string, unknown>);

          // Search for specific phone number
          const leadStr = JSON.stringify(lead);
          if (leadStr.includes(PHONE_SEARCH)) {
            const closure = this.getStr(lead, ["closure", "Closure"]);
            const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
            const agentEmail = lastModifiedByUser?.orgCode as string || "unknown";
            const campaignObj = (lead.campaign || lead.Campaign) as Record<string, unknown> | undefined;
            const campaignCode = campaignObj ? this.getStr(campaignObj, ["code", "Code"]) : "unknown";
            console.log(`[EnreachAdapter] *** PHONE ${PHONE_SEARCH} FOUND in raw data! closure=${closure}, agent=${agentEmail}, campaign=${campaignCode}`);
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
              const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
              const agentEmail = lastModifiedByUser?.orgCode as string || "unknown";
              if (externalId) {
                skipReasonMap.set(externalId, `data_filter:email=${agentEmail}`);
              }
            }
            return passes;
          });
          filteredByDataFilters += (beforeFilter - filtered.length);
        }

        // Map leads to sales, then filter by valid email
        const mappedSales = filtered.map((lead) => this.mapLeadToSale(lead, mappingLookup));
        
        const VALID_EMAIL_DOMAINS = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
        const WHITELISTED_EMAILS = ["kongtelling@gmail.com", "rasmusventura700@gmail.com"];
        const isValidSyncEmail = (email: string | null | undefined): boolean => {
          if (!email) return false;
          const emailLower = email.toLowerCase();
          if (WHITELISTED_EMAILS.includes(emailLower)) return true;
          return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
        };
        
        const validSales = mappedSales.filter(sale => {
          if (!isValidSyncEmail(sale.agentEmail)) {
            const externalId = sale.externalId;
            if (externalId) {
              skipReasonMap.set(externalId, `invalid_email:${sale.agentEmail || 'empty'}`);
            }
            filteredByEmail++;
            return false;
          }
          return true;
        });

        return validSales;
      };

      const results = await this.processPageByPage(endpoint, pageProcessor);

      // Store debug data for later retrieval
      this.lastDebugData = {
        rawLeads: allRawLeads,
        processedSales: results,
        skipReasonMap: skipReasonMap,
      };

      // Log diagnostic summary
      console.log(`[EnreachAdapter] ===== RANGE SYNC DIAGNOSTICS for ${this.dialerName} =====`);
      console.log(`[EnreachAdapter] Range: ${fromStr} -> ${toStr}`);
      console.log(`[EnreachAdapter] Total leads from API: ${totalLeadsReceived}`);
      console.log(`[EnreachAdapter] Leads with closure=success: ${closureSuccessCount}`);
      console.log(`[EnreachAdapter] Filtered out by data filters: ${filteredByDataFilters}`);
      console.log(`[EnreachAdapter] Filtered out by email whitelist: ${filteredByEmail}`);
      console.log(`[EnreachAdapter] Final sales count: ${results.length}`);
      console.log(`[EnreachAdapter] Debug data stored: ${allRawLeads.length} raw leads, ${skipReasonMap.size} skip reasons`);

      // Check if phone number was found
      const phoneFound = allRawLeads.some(l => JSON.stringify(l).includes(PHONE_SEARCH));
      console.log(`[EnreachAdapter] Phone ${PHONE_SEARCH} found in raw data: ${phoneFound}`);
      console.log(`[EnreachAdapter] ===== END RANGE DIAGNOSTICS =====`);

      return results;
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
    let dataObj = (lead.data || lead.Data) as Record<string, unknown> | undefined;

    // Normalize lowercase keys from /leads endpoint to match pricing rules
    if (this.usesLeadsEndpoint && dataObj) {
      dataObj = this.normalizeLeadsData(dataObj as Record<string, string>) as Record<string, unknown>;
      // Update raw lead.data so raw_payload gets normalized keys
      if (lead.data) lead.data = dataObj;
      if (lead.Data) lead.Data = dataObj;
    }

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
    // Smart agent-email: validate against known domains to avoid "Bloomreach_API" etc.
    const VALID_AGENT_DOMAINS = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
    const isValidAgentEmail = (email: string | undefined): boolean => {
      if (!email) return false;
      return VALID_AGENT_DOMAINS.some(d => email.toLowerCase().endsWith(d));
    };
    const firstOrgCode = firstProcessedByUser?.orgCode as string | undefined;
    const lastOrgCode = lastModifiedByUser?.orgCode as string | undefined;
    let agentOrgCode = "";
    if (isValidAgentEmail(firstOrgCode)) {
      agentOrgCode = firstOrgCode!;
    } else if (isValidAgentEmail(lastOrgCode)) {
      agentOrgCode = lastOrgCode!;
    } else {
      agentOrgCode = firstOrgCode || lastOrgCode || "";
    }

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

      customerPhone = this.getStr(dataObj, [
        "Telefon1", "Telefon", "Phone", "Mobile",
        "contact_number", "SUBSCRIBER_ID", "Telefon Abo1",
        "phoneNumber", "PhoneNumber", "Mobilnummer"
      ]);
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

    const saleDate = enreachToUTC(this.getStr(lead, ["firstProcessedTime", "lastModifiedTime"]));

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
      console.log(`[EnreachAdapter] Evaluating ${extractionConfig.conditionalRules.length} conditional rules for lead ${lead.uniqueId || 'unknown'}`);
      for (const rule of extractionConfig.conditionalRules) {
        const ruleLabel = rule.staticProductName || rule.extractionType || 'unknown';
        // Check if rule conditions pass
        if (!this.checkExtractionRuleConditions(rule, dataObj, lead)) {
          console.log(`[EnreachAdapter] Rule "${ruleLabel}" (${rule.extractionType}) - conditions NOT met`);
          continue;
        }
        const extractedProducts = this.extractFromRule(rule, dataObj, lead);
        console.log(`[EnreachAdapter] Rule "${ruleLabel}" (${rule.extractionType}) - conditions MET, extracted ${extractedProducts.length} products: ${extractedProducts.map(p => p.name).join(', ')}`);
        if (extractedProducts.length > 0) {
          products.push(...extractedProducts);
          // Removed break to allow multiple matching rules
        }
      }
      console.log(`[EnreachAdapter] Total extracted products: ${products.length} - ${products.map(p => p.name).join(', ')}`);
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
          // Parse quantity from the conditionKey value (e.g., "5GI salg": 2)
          let qty = 1;
          if (rule.conditionKey) {
            const conditionValue = this.getValue(dataObj, [rule.conditionKey]);
            const parsed = parseInt(String(conditionValue), 10);
            if (!isNaN(parsed) && parsed > 0) {
              qty = parsed;
            }
          }
          products.push({
            name: rule.staticProductName,
            externalId: rule.staticProductName,
            quantity: qty,
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

    const checkRuleWithFallback = (rule: DataFilterRule): boolean => {
      if (this.checkRule(lead, rule)) return true;
      // Bloomreach_API fallback: try firstProcessedByUser when lastModifiedByUser fails
      if (rule.field === "lastModifiedByUser.orgCode") {
        const fallbackRule = { ...rule, field: "firstProcessedByUser.orgCode" };
        if (this.checkRule(lead, fallbackRule)) {
          console.log(`[EnreachAdapter] Bloomreach fallback: lastModifiedByUser failed, firstProcessedByUser passed for filter in group`);
          return true;
        }
      }
      return false;
    };

    if (group.logic === "OR") {
      return group.rules.some(checkRuleWithFallback);
    } else {
      return group.rules.every(checkRuleWithFallback);
    }
  }

  private passesDataFilters(lead: HeroBaseLead, filters: DataFilterRule[], groups?: DataFilterGroup[], groupsLogic?: 'AND' | 'OR'): boolean {
    // FIRST: Check legacy filters (these are always AND, must ALL pass)
    if (filters && filters.length > 0) {
      const passesLegacy = filters.every((rule) => {
        if (this.checkRule(lead, rule)) return true;
        // Bloomreach_API fallback: try firstProcessedByUser when lastModifiedByUser fails
        if (rule.field === "lastModifiedByUser.orgCode") {
          const fallbackRule = { ...rule, field: "firstProcessedByUser.orgCode" };
          if (this.checkRule(lead, fallbackRule)) {
            console.log(`[EnreachAdapter] Bloomreach fallback: lastModifiedByUser failed, firstProcessedByUser passed for legacy filter`);
            return true;
          }
        }
        return false;
      });
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

      const endpoint = this.buildLeadsEndpoint(modifiedFrom);

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

    // Determine which org codes to use for calls
    let orgCodesToFetch: string[] = [];
    
    if (this.callsOrgCodes && this.callsOrgCodes.length > 0) {
      // Use configured multi-org codes
      orgCodesToFetch = this.callsOrgCodes;
      console.log(`[EnreachAdapter] Using configured callsOrgCodes: ${JSON.stringify(orgCodesToFetch)}`);
    } else {
      // Fallback to single orgCode or auto-detection
      try {
        const accountInfo: any = await this.get("/myaccount");
        console.log(`[EnreachAdapter] /myaccount response: ${JSON.stringify(accountInfo)}`);

        if (accountInfo && accountInfo.OrgCode) {
          if (!this.orgCode || this.orgCode.includes('@') || this.orgCode !== accountInfo.OrgCode) {
            console.log(`[EnreachAdapter] Auto-detected correct OrgCode: ${accountInfo.OrgCode} (was configured as: ${this.orgCode})`);
            this.orgCode = accountInfo.OrgCode;
          }
        }

        if (this.orgCode && this.orgCode.includes('@')) {
          console.warn(`[EnreachAdapter] OrgCode '${this.orgCode}' appears to be an email. Forcing fallback to 'Salg'.`);
          this.orgCode = 'Salg';
        }
      } catch (err) {
        console.warn(`[EnreachAdapter] Diagnostic /myaccount check failed. Continuing anyway. Error: ${err}`);
        if (this.orgCode && this.orgCode.includes('@')) {
          this.orgCode = 'Salg';
        }
      }

      orgCodesToFetch = [this.orgCode || 'Salg'];
      console.log(`[EnreachAdapter] Using single orgCode: ${orgCodesToFetch[0]}`);
    }

    // Parse date range
    const startDate = new Date(range.from);
    const endDate = new Date(range.to);

    console.log(`[EnreachAdapter] Fetching calls from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`[EnreachAdapter] Fetching from ${orgCodesToFetch.length} org code(s): ${orgCodesToFetch.join(', ')}`);

    // Generate all days in the range
    const days: string[] = [];
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      days.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[EnreachAdapter] Processing ${days.length} day(s) in chunks of 2 hours across ${orgCodesToFetch.length} org code(s)...`);

    // Fetch calls for each org code and deduplicate
    const allCalls: StandardCall[] = [];
    const seenIds = new Set<string>();
    let totalChunks = 0;
    let totalCallsFetched = 0;
    const statsPerOrg: Record<string, { fetched: number; unique: number }> = {};

    for (const orgCode of orgCodesToFetch) {
      console.log(`[EnreachAdapter] ===== Processing OrgCode: ${orgCode} =====`);
      statsPerOrg[orgCode] = { fetched: 0, unique: 0 };

      for (const day of days) {
        // Divide each day into 2-hour chunks (12 chunks per day)
        const chunks: { startTime: string; timeSpan: string }[] = [];
        for (let hour = 0; hour < 24; hour += 2) {
          const startTime = `${day}T${String(hour).padStart(2, '0')}:00:00Z`;
          chunks.push({ startTime, timeSpan: 'PT2H' });
        }

        // Fetch each chunk for this org code
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          totalChunks++;

          try {
            const chunkCalls = await this.fetchCallsChunkWithOrg(chunk.startTime, chunk.timeSpan, orgCode);

            // Deduplicate by uniqueId across ALL org codes
            let newCalls = 0;
            for (const call of chunkCalls) {
              if (!seenIds.has(call.externalId)) {
                seenIds.add(call.externalId);
                allCalls.push(call);
                newCalls++;
                statsPerOrg[orgCode].unique++;
              }
            }

            totalCallsFetched += chunkCalls.length;
            statsPerOrg[orgCode].fetched += chunkCalls.length;

            // Small delay to avoid rate limiting
            if (i < chunks.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`[EnreachAdapter] Error fetching chunk ${chunk.startTime} for ${orgCode}:`, error);
          }
        }
      }

      console.log(`[EnreachAdapter] Completed OrgCode ${orgCode}: Fetched ${statsPerOrg[orgCode].fetched}, Unique added: ${statsPerOrg[orgCode].unique}`);
    }

    console.log(`[EnreachAdapter] ===== MULTI-ORG CALL FETCH SUMMARY =====`);
    console.log(`[EnreachAdapter] Org codes processed: ${orgCodesToFetch.join(', ')}`);
    console.log(`[EnreachAdapter] Total chunks processed: ${totalChunks}`);
    console.log(`[EnreachAdapter] Total calls fetched: ${totalCallsFetched}`);
    console.log(`[EnreachAdapter] Unique calls after cross-org deduplication: ${allCalls.length}`);
    console.log(`[EnreachAdapter] Duplicates removed: ${totalCallsFetched - allCalls.length}`);
    for (const [org, stats] of Object.entries(statsPerOrg)) {
      console.log(`[EnreachAdapter]   - ${org}: ${stats.fetched} fetched, ${stats.unique} unique`);
    }
    console.log(`[EnreachAdapter] ========================================`);

    return allCalls;
  }

  /**
   * Helper method to fetch a single chunk of calls with a specific org code
   */
  private async fetchCallsChunkWithOrg(startTime: string, timeSpan: string, orgCode: string): Promise<StandardCall[]> {
    const formattedStartTime = startTime;
    const orgParam = orgCode.trim();
    const endpoint = `/calls?OrgCode=${orgParam}&StartTime=${encodeURIComponent(formattedStartTime)}&TimeSpan=${encodeURIComponent(timeSpan)}&Limit=5000`;

    try {
      const data = await this.get(endpoint);

      if (Array.isArray(data) && data.length > 0) {
        return this.mapCdrsToStandardCalls(data);
      } else if (Array.isArray(data)) {
        return [];
      } else {
        console.warn(`[EnreachAdapter] Unexpected response format from ${endpoint}`);
        return [];
      }
    } catch (error) {
      console.error(`[EnreachAdapter] Error fetching chunk for ${orgCode}:`, error);
      return [];
    }
  }

  /**
   * Helper method to fetch a single chunk of calls (backwards compatibility)
   */
  private async fetchCallsChunk(startTime: string, timeSpan: string): Promise<StandardCall[]> {
    const orgParam = this.orgCode ? this.orgCode.trim() : 'Salg';
    return this.fetchCallsChunkWithOrg(startTime, timeSpan, orgParam);
  }

  private parseISO8601Duration(duration: string | undefined | null): number {
    if (!duration || typeof duration !== 'string') return 0;

    // Simple parser for PT12M42S, PT6S, etc.
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.\d+)?S)?/;
    const matches = duration.match(regex);
    if (!matches) return 0;

    const hours = parseInt(matches[1] || '0', 10);
    const minutes = parseInt(matches[2] || '0', 10);
    const seconds = parseInt(matches[3] || '0', 10);

    return (hours * 3600) + (minutes * 60) + seconds;
  }

  private mapCdrsToStandardCalls(records: any[]): StandardCall[] {
    return records.map(r => {
      // Determine status
      let status: StandardCall['status'] = 'OTHER';
      const result = (r.Result || r.result || r.endCause || '').toLowerCase();
      const connected = r.connected === true || r.Connected === true;

      if (connected || result === 'answered' || result === 'connected' || r.IsAnswered) {
        status = 'ANSWERED';
      } else if (result === 'busy') {
        status = 'BUSY';
      } else if (result === 'noanswer' || result === 'no answer' || result === 'no_answer' || result === 'noresponse') {
        status = 'NO_ANSWER';
      } else if (result === 'failed') {
        status = 'FAILED';
      }

      // Parse durations
      const talkTime = this.parseISO8601Duration(r.conversationDuration || r.ConversationDuration);
      const dialTime = this.parseISO8601Duration(r.dialingDuration || r.DialingDuration);
      const wrapTime = this.parseISO8601Duration(r.wrapUpDuration || r.WrapUpDuration);

      // Fallback for direct seconds if available
      const altDuration = Number(r.DurationTotalSeconds || r.duration || r.Duration || 0);
      const talkSeconds = talkTime > 0 ? talkTime : altDuration;

      // Attempt to find an email for the agent to help with matching
      // HEROBASE/ENREACH: 'user.orgCode' almost always contains the agent email
      const possibleEmail = this.getStr(r.user || r.User, ["orgCode", "OrgCode", "email", "Email", "username", "Username"]);
      const agentEmail = (possibleEmail && possibleEmail.includes('@')) ? possibleEmail : undefined;

      // Map to StandardCall
      return {
        externalId: String(r.uniqueId || r.UniqueId || r.Id || r.id || r.CallId),
        integrationType: 'enreach',
        dialerName: this.dialerName,
        startTime: r.StartTime || r.startTime || r.Time || new Date().toISOString(),
        endTime: r.EndTime || r.endTime || r.StartTime || r.startTime || new Date().toISOString(),
        durationSeconds: talkSeconds,
        totalDurationSeconds: talkSeconds + dialTime + wrapTime,
        status: status,
        agentExternalId: String(r.user?.uniqueId || r.User?.UniqueId || r.UserId || r.agentId || 'unknown'),
        campaignExternalId: String(r.campaign?.uniqueId || r.Campaign?.UniqueId || r.CampaignId || 'unknown'),
        leadExternalId: String(r.uniqueLeadId || r.LeadUniqueId || r.LeadId || 'unknown'),
        metadata: {
          project: r.campaign?.code || r.Campaign?.Code || r.ProjectName,
          result: r.endCause || r.Result || r.Closure || r.leadClosure,
          number: r.leadPhoneNumber || r.PhoneNumber || r.Phone,
          orgCode: this.orgCode,
          agentEmail: agentEmail,
          dialingDuration: dialTime,
          wrapUpDuration: wrapTime,
          isSale: (r.leadClosure || '').toLowerCase() === 'success' || (r.Closure || '').toLowerCase() === 'success'
        }
      };
    });
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    return [];
  }

  // ==========================================
  // SESSION FETCHING (ALL outcomes for hitrate)
  // ==========================================

  async fetchSessions(days: number): Promise<StandardSession[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return this.fetchSessionsRange({
      from: cutoffDate.toISOString(),
      to: new Date().toISOString(),
    });
  }

  async fetchSessionsRange(range: { from: string; to: string }): Promise<StandardSession[]> {
    try {
      const fromStr = range.from.split("T")[0];
      // Bump toStr by +1 day because HeroBase treats ModifiedTo as exclusive
      const toDate = new Date(range.to);
      toDate.setUTCDate(toDate.getUTCDate() + 1);
      const toStr = toDate.toISOString().split("T")[0];
      console.log(`[EnreachAdapter] Fetching ALL sessions (all closures) for range ${fromStr} -> ${toStr} (ModifiedTo bumped +1d for exclusive API)`);

      const endpoint = this.buildLeadsEndpoint(fromStr, toStr);

      const allSessions: StandardSession[] = [];
      const seenIds = new Set<string>();
      const closureTypes = new Map<string, number>();
      let skip = 0;
      const take = 500;
      let hasMore = true;
      let page = 1;
      let totalProcessed = 0;

      while (hasMore && totalProcessed < 50000) {
        const separator = endpoint.includes("?") ? "&" : "?";
        const pagedEndpoint = `${endpoint}${separator}skip=${skip}&take=${take}`;

        try {
          const data = (await this.get(pagedEndpoint)) as unknown;
          let pageResults: Record<string, unknown>[] = [];

          if (Array.isArray(data)) {
            pageResults = data;
          } else if (data && typeof data === "object") {
            const wrapper = data as Record<string, unknown>;
            pageResults = (wrapper.Results || wrapper.results || wrapper.Leads || wrapper.leads || []) as Record<string, unknown>[];
          }

          if (pageResults.length === 0) {
            hasMore = false;
            break;
          }

          for (const lead of pageResults) {
            const externalId = this.getStr(lead, ["uniqueId", "UniqueId"]);
            if (!externalId || seenIds.has(externalId)) continue;
            seenIds.add(externalId);

            const closure = this.getStr(lead, ["closure", "Closure"]) || "unknown";
            closureTypes.set(closure, (closureTypes.get(closure) || 0) + 1);

            // Map closure to session status
            const status = closure.toLowerCase() === "success" ? "success" : closure.toLowerCase();

            const firstProcessedByUser = (lead.firstProcessedByUser || lead.FirstProcessedByUser) as Record<string, unknown> | undefined;
            const lastModifiedByUser = (lead.lastModifiedByUser || lead.LastModifiedByUser) as Record<string, unknown> | undefined;
            const campaignObj = (lead.campaign || lead.Campaign) as Record<string, unknown> | undefined;

            const agentOrgCode = this.getStr(firstProcessedByUser, ["orgCode", "OrgCode"]) ||
              this.getStr(lastModifiedByUser, ["orgCode", "OrgCode"]) || undefined;

            const campaignId = campaignObj ? this.getStr(campaignObj, ["uniqueId", "UniqueId", "code"]) : undefined;

            const startTime = this.getStr(lead, ["firstProcessedTime", "FirstProcessedTime"]) || undefined;
            const endTime = this.getStr(lead, ["lastModifiedTime", "LastModifiedTime"]) || undefined;

            // Calculate session duration if both times available
            let sessionSeconds: number | undefined;
            if (startTime && endTime) {
              const diff = new Date(endTime).getTime() - new Date(startTime).getTime();
              if (diff > 0) sessionSeconds = Math.round(diff / 1000);
            }

            allSessions.push({
              externalId,
              integrationType: "enreach",
              dialerName: this.dialerName,
              leadExternalId: externalId, // In Enreach, lead ID = session ID
              agentExternalId: agentOrgCode,
              campaignExternalId: campaignId,
              status,
              startTime,
              endTime,
              sessionSeconds,
              hasCdr: false, // CDR data comes from /calls endpoint
              metadata: {
                closure,
                campaignName: campaignObj ? this.getStr(campaignObj, ["code", "Code", "name", "Name"]) : undefined,
              },
            });
          }

          totalProcessed += pageResults.length;
          console.log(`[EnreachAdapter] Sessions page ${page}: ${pageResults.length} leads (total sessions: ${allSessions.length})`);

          if (pageResults.length < take) {
            hasMore = false;
          } else {
            skip += take;
            page++;
            await new Promise(r => setTimeout(r, 50));
          }
        } catch (e) {
          console.error(`[EnreachAdapter] Error fetching sessions page ${page}:`, e);
          hasMore = false;
        }
      }

      // Log unique closure types for diagnostics
      console.log(`[EnreachAdapter] ===== SESSION CLOSURE TYPES for ${this.dialerName} =====`);
      for (const [type, count] of closureTypes.entries()) {
        console.log(`[EnreachAdapter]   ${type}: ${count}`);
      }
      console.log(`[EnreachAdapter] Total unique sessions: ${allSessions.length}`);
      console.log(`[EnreachAdapter] ===== END SESSION DIAGNOSTICS =====`);

      return allSessions;
    } catch (error) {
      console.error("[EnreachAdapter] Critical error in fetchSessionsRange:", error);
      return [];
    }
  }

  /**
   * Normalize lowercase data keys from /leads endpoint to match pricing rule conditions.
   * The /leads endpoint returns keys like "a-kasse salg" but pricing rules expect "A-kasse salg".
   */
  private normalizeLeadsData(data: Record<string, string>): Record<string, string> {
    const KNOWN_KEY_MAP: Record<string, string> = {
      "a-kasse salg": "A-kasse salg",
      "a-kasse type": "A-kasse type",
      "dækningssum": "Dækningssum",
      "daekningssum": "Dækningssum",
      "forening": "Forening",
      "lønsikring": "Lønsikring",
      "loensikring": "Lønsikring",
      "eksisterende medlem": "Eksisterende medlem",
      "medlemsnummer": "Medlemsnummer",
      "nuværende a-kasse": "Nuværende a-kasse",
      "nuvaerende a-kasse": "Nuværende a-kasse",
      "resultat af samtalen": "Resultat af samtalen",
      "ja - afdeling": "Ja - Afdeling",
      "leadudfald": "Leadudfald",
      "navn1": "Navn1",
      "navn2": "Navn2",
      "telefon1": "Telefon1",
    };

    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      const mappedKey = KNOWN_KEY_MAP[lowerKey];
      if (mappedKey) {
        normalized[mappedKey] = value;
      } else if (key !== lowerKey) {
        // Already has some casing, keep as-is
        normalized[key] = value;
      } else {
        // Unknown lowercase key: capitalize first letter
        normalized[key.charAt(0).toUpperCase() + key.slice(1)] = value;
      }
    }

    console.log(`[EnreachAdapter] Normalized ${Object.keys(data).length} data keys for /leads endpoint`);
    return normalized;
  }
}
