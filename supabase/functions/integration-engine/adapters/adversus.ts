import { DialerAdapter, ApiMetrics } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardCall, StandardSession, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";
import { RateLimiter } from "../utils/rate-limiter.ts";

interface AdversusCredentials {
  username?: string;
  password?: string;
  ADVERSUS_API_USERNAME?: string;
  ADVERSUS_API_PASSWORD?: string;
}

export class AdversusAdapter implements DialerAdapter {
  private authHeader: string;
  private baseUrl = "https://api.adversus.io";
  private dialerName: string;

  // API metrics tracking
  private _metrics: ApiMetrics = { apiCalls: 0, rateLimitHits: 0, retries: 0 };

  // Burst-throttling: minimum 500ms between API calls
  private lastRequestTime = 0;
  private throttleMs = 500;

  getMetrics(): ApiMetrics {
    return { ...this._metrics };
  }

  resetMetrics(): void {
    this._metrics = { apiCalls: 0, rateLimitHits: 0, retries: 0 };
  }

  // Debug data for calls
  private lastDebugData: {
    rawCalls: Record<string, unknown>[];
    processedCalls: { externalId: string }[];
    skipReasonMap: Map<string, string>;
  } | null = null;

  constructor(credentials?: AdversusCredentials | Record<string, string> | null, dialerName?: string) {
    // Extract credentials - support multiple key formats
    let user: string | undefined;
    let pass: string | undefined;

    if (credentials && typeof credentials === "object") {
      // Support both formats: {username, password} or {ADVERSUS_API_USERNAME, ADVERSUS_API_PASSWORD}
      user = credentials.username || credentials.ADVERSUS_API_USERNAME;
      pass = credentials.password || credentials.ADVERSUS_API_PASSWORD;
    }

    if (!user || !pass) {
      throw new Error("[AdversusAdapter] No valid credentials provided. Required: username/password or ADVERSUS_API_USERNAME/ADVERSUS_API_PASSWORD");
    }

    this.authHeader = btoa(`${user}:${pass}`);
    this.dialerName = dialerName || "Adversus";
  }

  getLastDebugData() {
    return this.lastDebugData;
  }

  setDialerName(name: string) {
    this.dialerName = name;
  }

  private parseRetryAfterMs(headerValue: string | null): number | null {
    if (!headerValue) return null;

    const asSeconds = Number(headerValue);
    if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
      return asSeconds * 1000;
    }

    const asDate = Date.parse(headerValue);
    if (!Number.isNaN(asDate)) {
      return Math.max(0, asDate - Date.now());
    }

    return null;
  }

  private addJitter(delayMs: number): number {
    const jitterFactor = 0.2; // ±20%
    const randomOffset = (Math.random() * 2 - 1) * jitterFactor;
    return Math.max(250, Math.round(delayMs * (1 + randomOffset)));
  }

  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestTime;
    if (elapsed < this.throttleMs) {
      await new Promise(r => setTimeout(r, this.throttleMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async get(endpoint: string, retries = 3, baseDelay = 5000): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      await this.throttle();
      this._metrics.apiCalls++;
      const res = await fetch(`${this.baseUrl}/v1${endpoint}`, {
        headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" },
      });

      if (res.status === 429) {
        this._metrics.rateLimitHits++;
        if (attempt === retries) {
          throw new Error("Rate Limit Adversus Excedido (after retries)");
        }
        this._metrics.retries++;
        const retryAfterMs = this.parseRetryAfterMs(res.headers.get("Retry-After"));
        const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), 20000); // 5s, 10s, 20s (capped)
        const delay = this.addJitter(retryAfterMs ?? exponentialDelay);

        console.log(
          `[Adversus] Rate limited (429), waiting ${delay}ms before retry ${attempt}/${retries}${retryAfterMs ? " (Retry-After honored)" : ""}`,
        );
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) throw new Error(`Adversus API Error ${res.status}`);
      return await res.json();
    }
    // Should not reach here but TypeScript needs return
    throw new Error("Adversus API Error: Retries exhausted");
  }

  async fetchUsers(): Promise<StandardUser[]> {
    const data = await this.get("/users");
    const users = data.users || data || [];

    return users
      .filter((u: any) => {
        // Skip users without real email
        if (!u.email || u.email.trim() === '') {
          console.log(`[Adversus] Skipping user ${u.id} - no email`);
          return false;
        }
        return true;
      })
      .map((u: any) => ({
        externalId: String(u.id),
        name: u.name || u.displayName,
        email: u.email,
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

  /**
   * Lightweight raw sales fetch for field sampling.
   * Skips lead enrichment (buildLeadDataMap) to be fast (~2-3 seconds vs ~30 seconds).
   */
  async fetchSalesRaw(limit: number = 20): Promise<Record<string, unknown>[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const filterStr = encodeURIComponent(JSON.stringify({ 
      lastModifiedTime: { $gt: startDate.toISOString() } 
    }));
    
    const url = `${this.baseUrl}/sales?pageSize=${limit}&page=1&filters=${filterStr}`;
    this._metrics.apiCalls++;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${this.authHeader}` },
    });
    if (!res.ok) throw new Error(`Adversus API Error ${res.status}`);
    const data = await res.json();
    const sales = data.sales || [];
    console.log(`[Adversus] fetchSalesRaw: Retrieved ${sales.length} raw sales (limit: ${limit})`);
    return sales;
  }

  async fetchSales(days: number, campaignMappings?: CampaignMappingConfig[], maxRecords?: number): Promise<StandardSale[]> {
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Cap lookback to max 7 days to avoid fetching stale data
    const MAX_MODIFIED_DAYS = 7;
    const maxLookback = new Date();
    maxLookback.setDate(maxLookback.getDate() - MAX_MODIFIED_DAYS);
    if (startDate < maxLookback) {
      console.log(`[Adversus] fetchSales: Capping startDate from ${startDate.toISOString()} to ${maxLookback.toISOString()} (max ${MAX_MODIFIED_DAYS} days)`);
      startDate = maxLookback;
    }

    const filterStr = encodeURIComponent(JSON.stringify({ lastModifiedTime: { $gt: startDate.toISOString() } }));

    // Build campaign lookup maps
    const campaignConfigMap = new Map<string, CampaignMappingConfig>();
    campaignMappings?.forEach(m => campaignConfigMap.set(m.adversusCampaignId, m));

    // Fetch users first to build a user lookup map
    const users = await this.fetchUsers();
    const userMap = new Map<string, StandardUser>();
    users.forEach(u => userMap.set(u.externalId, u));
    console.log(`[Adversus] Loaded ${users.length} users for agent lookup`);

    // Fetch secuencial con pageSize grande (1000) - más estable que paralelo
    let rawSales = await this.fetchSalesSequential(filterStr);
    console.log(`[Adversus] Fetched ${rawSales.length} sales`);

    // Sort newest first so we always prioritize recent sales
    rawSales.sort((a: any, b: any) => new Date(b.closedTime || b.created).getTime() - new Date(a.closedTime || a.created).getTime());
    
    // Pre-enrichment limit: slice BEFORE buildLeadDataMap to save API calls
    // NOTE: maxRecords is now set higher (60) to ensure today's sales are included
    if (maxRecords && rawSales.length > maxRecords) {
      rawSales = rawSales.slice(0, maxRecords);
      console.log(`[Adversus] Pre-enrichment limit: kept ${rawSales.length} newest (maxRecords=${maxRecords}), discarded ${rawSales.length} older`);
    } else {
      console.log(`[Adversus] All ${rawSales.length} sales within maxRecords limit (${maxRecords || 'unlimited'})`);
    }

    console.log(`[Adversus] Building lead data map from ${rawSales.length} leads...`);

    const leadIdToData = await this.buildLeadDataMap(rawSales, campaignConfigMap);
    console.log(`[Adversus] Built lead data map with ${leadIdToData.size} entries`);

    // Valid email domains for syncing
    const VALID_EMAIL_DOMAINS = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
    const WHITELISTED_EMAILS = ["kongtelling@gmail.com", "rasmusventura700@gmail.com"];
    const isValidSyncEmail = (email: string | null): boolean => {
      if (!email) return false;
      const emailLower = email.toLowerCase();
      if (WHITELISTED_EMAILS.includes(emailLower)) return true;
      return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
    };

    // Mapeo a StandardSale usando el mapa de OPPs y el mapa de usuarios
    // FILTER out sales with invalid emails at source to prevent DB pollution
    let skippedInvalidEmail = 0;

    const mappedSales = rawSales.map((s: any) => {
      const agentObj = s.ownedBy || s.createdBy;
      const agentId = typeof agentObj === "object" ? String(agentObj.id) : String(agentObj);

      // Enhanced email extraction with multiple fallbacks
      let agentEmail: string | null = null;
      let agentName: string | null = null;

      // 1. Try embedded object fields (most reliable)
      if (typeof agentObj === "object" && agentObj) {
        agentEmail = agentObj.email || agentObj.mail || agentObj.emailAddress || null;
        agentName = agentObj.name || agentObj.displayName || agentObj.fullName || null;

        // Try to extract email from username if it looks like an email
        if (!agentEmail && agentObj.username && String(agentObj.username).includes("@")) {
          agentEmail = String(agentObj.username);
        }
      }

      // 2. Try userMap lookup by ID
      if (!agentEmail && userMap.has(agentId)) {
        const user = userMap.get(agentId)!;
        agentEmail = user.email;
        agentName = agentName || user.name;
      }

      // 3. Try to find in lead data (some sales have agent email in lead)
      if (!agentEmail && s.lead) {
        const leadAgentEmail = s.lead.agentEmail || s.lead.sellerEmail || s.lead.salesRepEmail;
        if (leadAgentEmail && String(leadAgentEmail).includes("@")) {
          agentEmail = String(leadAgentEmail);
        }
      }

      // 4. SKIP sales without valid email instead of using pseudo-email
      if (!agentEmail || !isValidSyncEmail(agentEmail)) {
        return null; // Will be filtered out
      }

      agentName = agentName || "Desconocido";

      const campaignId = s.campaignId ? String(s.campaignId) : undefined;
      const leadId = s.leadId ? String(s.leadId) : undefined;

      // Obtener OPP del mapa preconstruido
      let externalReference: string | null = null;
      let clientCampaignId: string | null = null;

      if (campaignId && campaignConfigMap.has(campaignId)) {
        clientCampaignId = campaignConfigMap.get(campaignId)!.clientCampaignId;
      }

      // Buscar OPP en el mapa por leadId
      const leadData = leadId ? leadIdToData.get(leadId) : undefined;
      if (leadData?.opp) {
        externalReference = leadData.opp;
      }

      // Use sale ID (s.id) as the primary externalId - this is unique per sale in Adversus
      // Also store leadId separately for potential webhook matching
      const saleId = String(s.id);
      const leadIdValue = s.leadId ? String(s.leadId) : null;

      return {
        externalId: saleId,
        leadId: leadIdValue, // Store leadId for webhook matching
        integrationType: "adversus" as const,
        dialerName: this.dialerName,
        saleDate: s.closedTime || s.createdTime,

        agentExternalId: String(agentId),
        agentEmail: agentEmail,
        agentName: agentName,

        customerName: s.lead?.company || s.lead?.name || "",
        customerPhone: s.lead?.phone || leadData?.phone || "",

        campaignId: campaignId,
        campaignName: s.campaign?.name || undefined,
        externalReference: externalReference,
        clientCampaignId: clientCampaignId,

        products: (s.lines || []).map((l: any) => ({
          name: l.title || "Producto desconocido",
          externalId: String(l.productId),
          quantity: l.quantity || 1,
          unitPrice: l.unitPrice || 0,
          metadata: { rawLineId: l.id },
        })),

        // Store complete raw JSON from dialer with lead result fields
        rawPayload: {
          ...s,
          leadResultData: leadData?.resultData || [],
          leadResultFields: leadData?.resultFields || {},
        },

        metadata: {
          campaignId: s.campaignId,
          leadId: s.leadId,
          lead: s.lead,
        },
      };
    });

    // Filter out nulls (invalid email sales) and log count
    const validSales = mappedSales.filter((sale): sale is NonNullable<typeof sale> => sale !== null) as StandardSale[];
    skippedInvalidEmail = rawSales.length - validSales.length;
    
    if (skippedInvalidEmail > 0) {
      console.log(`[Adversus] Skipped ${skippedInvalidEmail} sales with invalid/missing email (whitelist filter)`);
    }

    return validSales;
  }
  async fetchSalesRange(range: { from: string; to: string }, campaignMappings?: CampaignMappingConfig[], maxRecords?: number, options?: { uncapped?: boolean; campaignIds?: string[] }): Promise<StandardSale[]> {
    const uncapped = options?.uncapped ?? false;
    const campaignIds = options?.campaignIds;
    const hasTimeFrom = range.from.includes("T")
    const hasTimeTo = range.to.includes("T")
    const fromDate = new Date(range.from)
    const toDate = new Date(range.to)
    if (!hasTimeFrom) fromDate.setHours(0, 0, 0, 0)
    if (!hasTimeTo) toDate.setHours(23, 59, 59, 999)
    const fromISO = fromDate.toISOString()
    const toISO = toDate.toISOString()

    // Cap lookback to max 7 days – UNLESS uncapped mode
    if (!uncapped) {
      const MAX_MODIFIED_DAYS = 7;
      const maxLookback = new Date();
      maxLookback.setDate(maxLookback.getDate() - MAX_MODIFIED_DAYS);
      if (fromDate < maxLookback) {
        console.log(`[Adversus] fetchSalesRange: Capping fromDate from ${fromISO} to ${maxLookback.toISOString()} (max ${MAX_MODIFIED_DAYS} days)`);
        fromDate.setTime(maxLookback.getTime());
      }
    } else {
      console.log(`[Adversus] fetchSalesRange: UNCAPPED mode – no lookback cap, fromDate=${fromISO}`);
    }

    const cappedFromISO = fromDate.toISOString();
    const filterStr = encodeURIComponent(JSON.stringify({ lastModifiedTime: { $gt: cappedFromISO, $lt: toISO } }));
    const campaignConfigMap = new Map<string, CampaignMappingConfig>();
    campaignMappings?.forEach(m => campaignConfigMap.set(m.adversusCampaignId, m));
    const users = await this.fetchUsers();
    const userMap = new Map<string, StandardUser>();
    users.forEach(u => userMap.set(u.externalId, u));
    console.log(`[Adversus] Loaded ${users.length} users for agent lookup`);
    let rawSales = await this.fetchSalesSequential(filterStr);
    console.log(`[Adversus] Fetched ${rawSales.length} sales (range, uncapped=${uncapped})`);

    // PRE-ENRICHMENT campaign filter: remove sales from irrelevant campaigns
    // BEFORE buildLeadDataMap to drastically reduce API calls and avoid timeout
    if (campaignIds && campaignIds.length > 0) {
      const before = rawSales.length;
      rawSales = rawSales.filter((s: any) => s.campaignId && campaignIds.includes(String(s.campaignId)));
      console.log(`[Adversus] Pre-enrichment campaign filter: ${before} -> ${rawSales.length} sales (campaigns: ${campaignIds.join(",")})`);
    }

    // Pre-enrichment limit – SKIP if uncapped
    if (!uncapped && maxRecords && rawSales.length > maxRecords) {
      rawSales.sort((a: any, b: any) => new Date(b.closedTime || b.created).getTime() - new Date(a.closedTime || a.created).getTime());
      rawSales = rawSales.slice(0, maxRecords);
      console.log(`[Adversus] Pre-enrichment limit: kept ${rawSales.length} newest (maxRecords=${maxRecords})`);
    } else if (uncapped) {
      console.log(`[Adversus] UNCAPPED: processing ALL ${rawSales.length} sales (no maxRecords limit)`);
    }

    const leadIdToData = await this.buildLeadDataMap(rawSales, campaignConfigMap, { fast: uncapped });
    console.log(`[Adversus] Built lead data map with ${leadIdToData.size} entries`);
    // Valid email domains for syncing (same as fetchSales)
    const VALID_EMAIL_DOMAINS = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
    const WHITELISTED_EMAILS = ["kongtelling@gmail.com", "rasmusventura700@gmail.com"];
    const isValidSyncEmail = (email: string | null): boolean => {
      if (!email) return false;
      const emailLower = email.toLowerCase();
      if (WHITELISTED_EMAILS.includes(emailLower)) return true;
      return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
    };

    let skippedInvalidEmail = 0;

    const mappedSales = rawSales.map((s: any) => {
      const agentObj = s.ownedBy || s.createdBy;
      const agentId = typeof agentObj === "object" ? String(agentObj.id) : String(agentObj);

      // Enhanced email extraction with multiple fallbacks
      let agentEmail: string | null = null;
      let agentName: string | null = null;

      // 1. Try embedded object fields
      if (typeof agentObj === "object" && agentObj) {
        agentEmail = agentObj.email || agentObj.mail || agentObj.emailAddress || null;
        agentName = agentObj.name || agentObj.displayName || agentObj.fullName || null;
        if (!agentEmail && agentObj.username && String(agentObj.username).includes("@")) {
          agentEmail = String(agentObj.username);
        }
      }

      // 2. Try userMap lookup
      if (!agentEmail && userMap.has(agentId)) {
        const user = userMap.get(agentId)!;
        agentEmail = user.email;
        agentName = agentName || user.name;
      }

      // 3. Try lead data
      if (!agentEmail && s.lead) {
        const leadAgentEmail = s.lead.agentEmail || s.lead.sellerEmail || s.lead.salesRepEmail;
        if (leadAgentEmail && String(leadAgentEmail).includes("@")) {
          agentEmail = String(leadAgentEmail);
        }
      }

      // 4. SKIP sales without valid email instead of using pseudo-email
      if (!agentEmail || !isValidSyncEmail(agentEmail)) {
        return null; // Will be filtered out
      }

      agentName = agentName || "Desconocido";
      const campaignId = s.campaignId ? String(s.campaignId) : undefined;
      const leadId = s.leadId ? String(s.leadId) : undefined;
      let externalReference: string | null = null;
      let clientCampaignId: string | null = null;
      if (campaignId && campaignConfigMap.has(campaignId)) {
        clientCampaignId = campaignConfigMap.get(campaignId)!.clientCampaignId;
      }
      const leadData = leadId ? leadIdToData.get(leadId) : undefined;
      if (leadData?.opp) {
        externalReference = leadData.opp;
      }
      const saleId = String(s.id);
      const leadIdValue = s.leadId ? String(s.leadId) : null;
      return {
        externalId: saleId,
        leadId: leadIdValue,
        integrationType: "adversus" as const,
        dialerName: this.dialerName,
        saleDate: s.closedTime || s.createdTime,
        agentExternalId: String(agentId),
        agentEmail,
        agentName,
        customerName: s.lead?.company || s.lead?.name || "",
        customerPhone: s.lead?.phone || leadData?.phone || "",
        campaignId,
        campaignName: s.campaign?.name || undefined,
        externalReference,
        clientCampaignId,
        products: (s.lines || []).map((l: any) => ({
          name: l.title || "Producto desconocido",
          externalId: String(l.productId),
          quantity: l.quantity || 1,
          unitPrice: l.unitPrice || 0,
          metadata: { rawLineId: l.id },
        })),
        rawPayload: {
          ...s,
          leadResultData: leadData?.resultData || [],
          leadResultFields: leadData?.resultFields || {},
        },
        metadata: {
          campaignId: s.campaignId,
          leadId: s.leadId,
          lead: s.lead,
        },
      };
    });

    // Filter out nulls (invalid email sales) and log count
    const validSales = mappedSales.filter((sale): sale is NonNullable<typeof sale> => sale !== null) as StandardSale[];
    skippedInvalidEmail = rawSales.length - validSales.length;
    
    if (skippedInvalidEmail > 0) {
      // In uncapped mode, log per-campaign breakdown of skipped sales
      if (uncapped) {
        const skippedByCampaign = new Map<string, number>();
        rawSales.forEach((s: any) => {
          const agentObj = s.ownedBy || s.createdBy;
          let email: string | null = null;
          if (typeof agentObj === "object" && agentObj) {
            email = agentObj.email || agentObj.mail || null;
          }
          if (!email && userMap.has(String(typeof agentObj === "object" ? agentObj?.id : agentObj))) {
            email = userMap.get(String(typeof agentObj === "object" ? agentObj?.id : agentObj))!.email;
          }
          const isValid = email && (["kongtelling@gmail.com", "rasmusventura700@gmail.com"].includes(email.toLowerCase()) || ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"].some(d => email!.toLowerCase().endsWith(d)));
          if (!isValid) {
            const cId = s.campaignId ? String(s.campaignId) : "unknown";
            skippedByCampaign.set(cId, (skippedByCampaign.get(cId) || 0) + 1);
          }
        });
        console.log(`[Adversus] UNCAPPED skipped breakdown by campaign:`, Object.fromEntries(skippedByCampaign));
      }
      console.log(`[Adversus] Skipped ${skippedInvalidEmail} sales with invalid/missing email (range, whitelist filter)`);
    }

    // In uncapped mode, log per-campaign breakdown of VALID sales
    if (uncapped) {
      const validByCampaign = new Map<string, number>();
      validSales.forEach(s => {
        const cId = s.campaignId || "unknown";
        validByCampaign.set(cId, (validByCampaign.get(cId) || 0) + 1);
      });
      console.log(`[Adversus] UNCAPPED valid sales breakdown by campaign:`, Object.fromEntries(validByCampaign));
    }

    return validSales;
  }

  // Interface for lead data with all result fields
  private LeadData = class {
    opp: string | null = null;
    resultData: Array<{ id: number; name?: string; label?: string; type?: string; value: any }> = [];
    resultFields: Record<string, any> = {};
    phone: string | null = null;
  };

  // Build lead data map by fetching only the leads referenced in sales (individually via fetchLeadById)
  private async buildLeadDataMap(
    sales: any[],
    campaignConfigMap: Map<string, CampaignMappingConfig>,
    options?: { fast?: boolean }
  ): Promise<Map<string, { opp: string | null; resultData: Array<{ id: number; name?: string; label?: string; type?: string; value: any }>; resultFields: Record<string, any>; phone: string | null }>> {
    const leadIdToData = new Map<string, { opp: string | null; resultData: Array<{ id: number; name?: string; label?: string; type?: string; value: any }>; resultFields: Record<string, any>; phone: string | null }>();

    // 1. Extract unique leadIds from sales
    const uniqueLeadIds = [...new Set(sales.map(s => s.leadId).filter(Boolean).map(String))];
    console.log(`[Adversus] buildLeadDataMap: ${uniqueLeadIds.length} unique leads to fetch from ${sales.length} sales`);

    if (uniqueLeadIds.length === 0) {
      return leadIdToData;
    }

    const oppPattern = /OPP-\d{4,6}/;
    let totalOpps = 0;
    let fetchSuccess = 0;
    let fetchFailed = 0;

    // 2. Fetch leads – use faster rate limiting in "fast" mode (backfill)
    const fast = options?.fast ?? false;
    const delayMs = fast ? 1500 : 2000; // 1.5s in fast mode vs 2s normal – safer for rate limits
    const rateLimiter = new RateLimiter(fast ? 20 : 25, 900); // 20 req/min fast vs 25 normal – stays well under 60/min limit
    console.log(`[Adversus] buildLeadDataMap: mode=${fast ? 'FAST' : 'normal'}, delay=${delayMs}ms, ${uniqueLeadIds.length} leads`);

    for (let i = 0; i < uniqueLeadIds.length; i++) {
      const leadId = uniqueLeadIds[i];

      await rateLimiter.waitForSlot();
      const leadData = await this.fetchLeadById(leadId).catch(e => {
        console.error(`[Adversus] Error fetching lead ${leadId}:`, e);
        return null;
      });

      if (!leadData) {
        fetchFailed++;
      } else {
        const resultData: Array<{ id: number; name?: string; label?: string; type?: string; value: any }> = leadData.resultData || [];
        const resultFields: Record<string, any> = {};
        let opp: string | null = null;

        if (Array.isArray(resultData)) {
          for (const field of resultData) {
            const fieldName = field?.name || field?.label;
            if (field && fieldName !== undefined) {
              resultFields[fieldName] = field.value;

              if (field.value) {
                const value = String(field.value);
                const match = value.match(oppPattern);
                if (match && !opp) {
                  opp = match[0];
                  totalOpps++;
                }
              }
            }
          }
        }

        let phone = leadData.phone || leadData.contactPhone || leadData.mobile || null;
        if (!phone && leadData.contactData) {
          const cd = leadData.contactData;
          phone = cd.Telefonnummer1 || cd['Kontakt nummer'] || cd.phone || cd.mobile || cd.Mobil || cd.Telefon || null;
        }
        leadIdToData.set(leadId, { opp, resultData, resultFields, phone });
        fetchSuccess++;
      }

      // Log progress every 50 leads in fast mode
      if (fast && (i + 1) % 50 === 0) {
        console.log(`[Adversus] buildLeadDataMap progress: ${i + 1}/${uniqueLeadIds.length} (${fetchSuccess} ok, ${fetchFailed} failed)`);
      }

      // Delay between each request
      if (i < uniqueLeadIds.length - 1) {
        await new Promise(r => setTimeout(r, delayMs));
      }
    }

    console.log(`[Adversus] buildLeadDataMap complete: ${fetchSuccess} fetched, ${fetchFailed} failed, ${totalOpps} OPPs found (${uniqueLeadIds.length} total)`);

    return leadIdToData;
  }

  /**
   * Fetch a single lead by ID - used as fallback when bulk fetch misses leads
   * NOTE: Adversus API returns { leads: [...] } even for single-lead queries
   */
  private async fetchLeadById(leadId: string): Promise<any | null> {
    const url = `${this.baseUrl}/v1/leads/${leadId}`;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        this._metrics.apiCalls++;
        const res = await fetch(url, {
          headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" }
        });

        if (res.status === 429) {
          this._metrics.rateLimitHits++;
          if (attempt > maxRetries) {
            console.log(`[Adversus] Lead ${leadId}: 429 after ${maxRetries} retries, giving up`);
            return null;
          }
          this._metrics.retries++;
          const retryAfter = res.headers.get("Retry-After");
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : NaN;
          const waitMs = !isNaN(retryAfterSec)
            ? retryAfterSec * 1000 + Math.floor(Math.random() * 1000)
            : Math.min(5000 * Math.pow(2, attempt - 1), 30000) + Math.floor(Math.random() * 1000);
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }

        if (!res.ok) {
          console.log(`[Adversus] Failed to fetch lead ${leadId}: ${res.status}`);
          return null;
        }

        const data = await res.json();
        if (data?.leads && Array.isArray(data.leads)) {
          return data.leads[0] || null;
        }
        return data;
      } catch (e) {
        if (attempt > maxRetries) {
          console.error(`[Adversus] Lead ${leadId}: error after ${maxRetries} retries:`, e);
          return null;
        }
        this._metrics.retries++;
        await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
      }
    }
    return null;
  }

  // Validar que el OPP tenga formato correcto
  private isValidOppNumber(value: string): boolean {
    if (!value) return false;
    // OPP-XXXXX o 4-6 dígitos
    if (value.match(/^OPP-\d{4,6}$/)) return true;
    if (value.match(/^\d{4,6}$/)) return true;
    return false;
  }

  // Fetch secuencial de ventas con pageSize grande - más estable que paralelo
  private async fetchSalesSequential(filterStr: string): Promise<any[]> {
    const allSales: any[] = [];
    const pageSize = 1000; // Máximo pageSize soportado por Adversus
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 100) { // Max 100,000 ventas
      const url = `${this.baseUrl}/sales?pageSize=${pageSize}&page=${page}&filters=${filterStr}`;
      let retryAttempt = 0;
      const maxRetries = 3;

      while (retryAttempt < maxRetries) {
        try {
          this._metrics.apiCalls++;
          const res = await fetch(url, { headers: { Authorization: `Basic ${this.authHeader}` } });

          if (res.status === 429) {
            this._metrics.rateLimitHits++;
            retryAttempt++;
            if (retryAttempt >= maxRetries) {
              console.log(`[Adversus] Page ${page}: Rate limited, max retries reached after ${maxRetries} attempts`);
              hasMore = false;
              break;
            }
            this._metrics.retries++;
            const retryAfterMs = this.parseRetryAfterMs(res.headers.get("Retry-After"));
            const exponentialDelay = Math.min(5000 * Math.pow(2, retryAttempt - 1), 20000); // 5s, 10s, 20s (capped)
            const delay = this.addJitter(retryAfterMs ?? exponentialDelay);
            console.log(`[Adversus] Rate limited on page ${page}, waiting ${delay}ms (retry ${retryAttempt}/${maxRetries})`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          if (!res.ok) {
            console.log(`[Adversus] Page ${page} failed with status ${res.status}`);
            hasMore = false;
            break;
          }

          const data = await res.json();
          const pageData = data.sales || data || [];

          if (pageData.length === 0) {
            hasMore = false;
          } else {
            allSales.push(...pageData);
            console.log(`[Adversus] Page ${page}: ${pageData.length} sales (total: ${allSales.length})`);

            if (pageData.length < pageSize) {
              hasMore = false; // Última página incompleta
            } else {
              page++;
              // Delay for at undgå rate limit (øget fra 50ms til 150ms)
              await new Promise(r => setTimeout(r, 150));
            }
          }
          break; // Success, exit retry loop
        } catch (e) {
          retryAttempt++;
          if (retryAttempt >= maxRetries) {
            console.error(`[Adversus] Error fetching page ${page} after ${maxRetries} attempts:`, e);
            hasMore = false;
            break;
          }
          this._metrics.retries++;

          const delay = 5000 * Math.pow(2, retryAttempt - 1);
          console.warn(`[Adversus] Error fetching page ${page}. Waiting ${delay}ms (retry ${retryAttempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      }
    }

    return allSales;
  }

  // Fetch leads for a campaign (used by field inspector)
  async fetchLeadsForCampaign(campaignId: string, pageSize = 100): Promise<any[]> {
    try {
      const filters = JSON.stringify({ campaignId: { "$eq": Number(campaignId) } });
      const url = `${this.baseUrl}/leads?filters=${encodeURIComponent(filters)}&pageSize=${pageSize}`;

      this._metrics.apiCalls++;
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" }
      });

      if (!res.ok) {
        console.log(`[Adversus] Failed to fetch leads for campaign ${campaignId}: ${res.status}`);
        return [];
      }

      const data = await res.json();
      return data.leads || data || [];
    } catch (e) {
      console.error(`[Adversus] Error fetching leads for campaign ${campaignId}:`, e);
      return [];
    }
  }

  /**
   * GDPR-Compliant CDR fetch - only IDs and metadata, NO personal Lead data
   * Tries multiple Adversus endpoints for Call Detail Records
   */
  /**
   * GDPR-Compliant CDR fetch - only IDs and metadata, NO personal Lead data
   */
  async fetchCalls(days: number): Promise<StandardCall[]> {
    const allCalls: StandardCall[] = [];
    const seenIds = new Set<string>();

    const accumulatedRaw: any[] = [];
    const accumulatedProcessed: any[] = [];

    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];

      console.log(`[Adversus] Day-by-day fetch: Processing day ${dayStr} (${i} days ago)`);
      const dailyCalls = await this.fetchCallsRange({ from: dayStr, to: dayStr });

      let addedCount = 0;
      for (const call of dailyCalls) {
        if (!seenIds.has(call.externalId)) {
          seenIds.add(call.externalId);
          allCalls.push(call);
          addedCount++;
        }
      }
      console.log(`[Adversus] Finished day ${dayStr}: Added ${addedCount} new calls. Total so far: ${allCalls.length}`);

      // Accumulate debug data
      const debugData = this.getLastDebugData();
      if (debugData && debugData.rawCalls.length > 0) {
        accumulatedRaw.push(...(debugData.rawCalls || []));
        accumulatedProcessed.push(...(debugData.processedCalls || []));
      }

      // Safety pause between days
      if (i > 0) await new Promise(r => setTimeout(r, 1000));
    }

    // Set complete debug data
    this.lastDebugData = {
      rawCalls: accumulatedRaw,
      processedCalls: accumulatedProcessed,
      skipReasonMap: new Map(),
    };

    return allCalls;
  }

  async fetchCallsRange(range: { from: string; to: string }): Promise<StandardCall[]> {
    // Adversus often prefers full ISO strings
    const startIso = range.from.includes('T') ? range.from : `${range.from}T00:00:00Z`;
    const endIso = range.to.includes('T') ? range.to : `${range.to}T23:59:59Z`;

    // Also keep simple YYYY-MM-DD for logging/checks
    const startDateStr = startIso.split('T')[0];
    const endDateStr = endIso.split('T')[0];

    console.log(`[Adversus] Fetching calls range ${startIso} -> ${endIso}`);

    // Per official Adversus API docs, use /cdr endpoint with $gt/$lt filter operators
    const filterObj = {
      insertedTime: {
        $gt: startIso,
        $lt: endIso
      }
    };
    const filterString = encodeURIComponent(JSON.stringify(filterObj));

    const endpoints = [
      `/cdr?filters=${filterString}`
    ];

    for (const endpointBase of endpoints) {
      let allRecords: any[] = [];
      const seenIds = new Set<string>();
      const seenHashes = new Set<string>();

      let page = 0; // START AT PAGE 0 (Matches standalone)
      let hasMore = true;
      let pageSize = 1000;
      let consecutiveEmptyPages = 0;

      console.log(`[Adversus] Starting deep sync for ${endpointBase}`);

      while (hasMore) {
        let retries = 0;
        const maxRetries = 3;
        let success = false;

        while (!success && retries < maxRetries) {
          try {
            const url = `${this.baseUrl}${endpointBase}&pageSize=${pageSize}&page=${page}`;
            const res = await fetch(url, {
              headers: {
                'Authorization': `Basic ${this.authHeader}`,
                'Content-Type': 'application/json'
              }
            });

            if (res.status === 429) {
              const waitTime = Math.min(5000 * Math.pow(2, retries), 20000);
              console.warn(`[Adversus] Rate limit hit (429). Waiting ${waitTime / 1000}s...`);
              await new Promise(r => setTimeout(r, waitTime));
              retries++;
              continue;
            }

            if (!res.ok) {
              const errorBody = await res.text();
              if (res.status === 404) {
                console.log(`[Adversus] Page ${page} 404 - end of data reached.`);
              } else {
                console.warn(`[Adversus] Page ${page} error ${res.status}: ${errorBody.substring(0, 100)}`);
              }
              hasMore = false;
              success = true;
              break;
            }

            const data = await res.json();
            let records = data.calls || data.cdr || data.cdrs || data.activities || data.data || [];
            if (!Array.isArray(records) && data.results && Array.isArray(data.results)) {
              records = data.results;
            }

            if (Array.isArray(records) && records.length > 0) {
              let outOfRange = 0;
              let duplicateId = 0;
              let duplicateHash = 0;

              const newRecords = records.filter((r: any) => {
                // Client-side date filter as safety net
                const callDateStr = r.insertedTime || r.startTime || r.started || r.created;
                if (callDateStr) {
                  const callDay = callDateStr.includes('T') ? callDateStr.split('T')[0] : callDateStr.split(' ')[0];
                  if (callDay < startDateStr || callDay > endDateStr) {
                    outOfRange++;
                    return false;
                  }
                }

                const id = String(r.id || r.uniqueId || r.uuid);
                const hashStr = JSON.stringify({
                  id: r.id || r.uniqueId || r.uuid,
                  startTime: r.startTime || r.started || r.created,
                  endTime: r.endTime || r.ended,
                  agentId: r.userId || r.agentId || r.ownedBy?.id,
                  campaignId: r.campaignId,
                  leadId: r.contactId || r.leadId,
                  duration: r.conversationSeconds || r.billsec,
                  status: r.disposition || r.hangupCause
                });

                if (id && id !== 'undefined' && seenIds.has(id)) {
                  duplicateId++;
                  return false;
                }
                if (seenHashes.has(hashStr)) {
                  duplicateHash++;
                  return false;
                }

                if (id && id !== 'undefined') seenIds.add(id);
                seenHashes.add(hashStr);
                return true;
              });

              if (records.length > 0) {
                consecutiveEmptyPages = 0;
              }

              if (newRecords.length > 0) {
                allRecords = allRecords.concat(newRecords);
              }

              // STRONG LOGGING
              console.log(`[Adversus] Page ${page} Report:
                - URL: ${url}
                - Raw records: ${records.length}
                - Filtered out of date range (${startDateStr} to ${endDateStr}): ${outOfRange}
                - Duplicate IDs: ${duplicateId}
                - Duplicate Hashes: ${duplicateHash}
                - SUCCESSFULLY ADDED: ${newRecords.length}
                - Accumulated Total: ${allRecords.length}`);

              if (records.length > 0) {
                const first = records[0];
                console.log(`[Adversus] Record Sample: id=${first.id}, insertedTime=${first.insertedTime}, startTime=${first.startTime || first.started}`);
                const firstDate = first.insertedTime || first.startTime || first.started;
                const lastDate = records[records.length - 1].insertedTime || records[records.length - 1].startTime || records[records.length - 1].started;
                console.log(`[Adversus] Page ${page} Date Sample: First[${firstDate}] Last[${lastDate}]`);
              }

              if (records.length < pageSize) {
                console.log(`[Adversus] Page ${page} size ${records.length} < ${pageSize}. End reached.`);
                hasMore = false;
              } else {
                page++;
                await new Promise(r => setTimeout(r, 400));
              }
            } else {
              // Truly empty response
              console.log(`[Adversus] Page ${page} is empty. No records found for this period.`);
              hasMore = false;
            }
            success = true;
          } catch (e) {
            console.error(`[Adversus] Exception on page ${page}:`, e);
            retries++;
            if (retries >= maxRetries) {
              hasMore = false;
              success = true;
            } else {
              await new Promise(r => setTimeout(r, 2000));
            }
          }
        }
      }

      if (allRecords.length > 0) {
        console.log(`[Adversus] Finished fetching range. Total unique records found: ${allRecords.length}`);
        const mappedCalls = this.mapCdrsToStandardCalls(allRecords);

        // Store debug data for calls
        this.lastDebugData = {
          rawCalls: allRecords,
          processedCalls: mappedCalls.map(c => ({ externalId: c.externalId })),
          skipReasonMap: new Map(),
        };
        return mappedCalls;
      } else {
        this.lastDebugData = null;
      }
    }
    return [];
  }

  private mapCdrsToStandardCalls(allCdrs: any[]): StandardCall[] {
    console.log(`[Adversus] Mapping ${allCdrs.length} CDRs to StandardCall format`);

    // Map to StandardCall (GDPR-compliant - only IDs)
    return allCdrs.map((cdr: any) => {
      // Map disposition to status - Adversus uses disposition field primarily
      const status = this.mapAdversusDisposition(cdr.disposition) ||
        this.mapAdversusHangupCause(cdr.hangupCause || cdr.hangup_cause);

      return {
        externalId: String(cdr.id || cdr.uniqueId || cdr.uuid),
        integrationType: "adversus" as const,
        dialerName: this.dialerName,

        // Adversus uses startTime, answerTime, endTime
        startTime: cdr.startTime || cdr.started || cdr.created || new Date().toISOString(),
        endTime: cdr.endTime || cdr.ended || cdr.created || new Date().toISOString(),

        // Adversus fields: conversationSeconds = talk time, durationSeconds = total time
        durationSeconds: Number(cdr.conversationSeconds || cdr.billsec || cdr.talkTime || 0),
        totalDurationSeconds: Number(cdr.durationSeconds || cdr.duration || cdr.totalDuration || 0),

        status,

        // ONLY IDs - No personal data (GDPR compliant)
        agentExternalId: String(cdr.userId || cdr.agentId || cdr.ownedBy?.id || ""),
        campaignExternalId: String(cdr.campaignId || ""),
        leadExternalId: String(cdr.contactId || cdr.leadId || ""),

        recordingUrl: cdr.recordingUrl || cdr.recording || (cdr.links?.recording) || undefined,

        metadata: {
          direction: cdr.source ? "outbound" : "inbound",
          callType: cdr.type,
          hangupCause: cdr.hangupCause,
          disposition: cdr.disposition,
          answerTime: cdr.answerTime,
        },
      };
    });
  }

  /**
   * Map Adversus disposition to unified status enum
   */
  private mapAdversusDisposition(disposition: string | undefined): StandardCall['status'] | null {
    if (!disposition) return null;

    const d = disposition.toLowerCase();

    // Answered / Success dispositions
    if (d.includes('answered') || d.includes('success') || d.includes('connected') || d.includes('sale') || d === 'answer') {
      return 'ANSWERED';
    }
    // No Answer
    if (d.includes('no answer') || d.includes('noanswer') || d.includes('no_answer') || d === 'ring') {
      return 'NO_ANSWER';
    }
    // Busy
    if (d.includes('busy')) {
      return 'BUSY';
    }
    // Failed / Voicemail / Other
    if (d.includes('voicemail') || d.includes('machine') || d.includes('answering')) {
      return 'NO_ANSWER'; // Map voicemail to no_answer since VOICEMAIL not in type
    }
    if (d.includes('fail') || d.includes('error') || d.includes('invalid')) {
      return 'FAILED';
    }

    return null; // Let hangup cause handle it
  }

  /**
   * Map Adversus hangup_cause to unified status enum
   */
  private mapAdversusHangupCause(cause: string | undefined): StandardCall['status'] {
    if (!cause) return 'OTHER';

    const c = cause.toUpperCase();

    // Answered / Success
    if (c.includes('NORMAL_CLEARING') || c.includes('SUCCESS') || c.includes('ANSWERED')) {
      return 'ANSWERED';
    }
    // No Answer
    if (c.includes('NO_USER_RESPONSE') || c.includes('NO_ANSWER') || c.includes('TIMEOUT')) {
      return 'NO_ANSWER';
    }
    // Busy
    if (c.includes('BUSY') || c.includes('USER_BUSY')) {
      return 'BUSY';
    }
    // Failed
    if (c.includes('CALL_REJECTED') || c.includes('FAIL') || c.includes('UNALLOCATED') || c.includes('INVALID')) {
      return 'FAILED';
    }

    return 'OTHER';
  }

  // ==========================================
  // SESSION FETCHING (ALL outcomes for hitrate)
  // ==========================================

  async fetchSessions(days: number): Promise<StandardSession[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return this.fetchSessionsRange({ from: startDate.toISOString(), to: new Date().toISOString() });
  }

  async fetchSessionsRange(range: { from: string; to: string }): Promise<StandardSession[]> {
    const startIso = range.from.includes('T') ? range.from : `${range.from}T00:00:00Z`;
    const endIso = range.to.includes('T') ? range.to : `${range.to}T23:59:59Z`;

    console.log(`[Adversus] Fetching sessions range ${startIso} -> ${endIso}`);

    const allSessions: StandardSession[] = [];
    const seenIds = new Set<string>();
    let page = 1;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore && page <= 100) {
      try {
        const filterObj = { startTime: { $gt: startIso, $lt: endIso } };
        const filterStr = encodeURIComponent(JSON.stringify(filterObj));
        const url = `/sessions?filters=${filterStr}&page=${page}&pageSize=${pageSize}&sortProperty=startTime&sortDirection=DESC`;

        const data = await this.get(url);
        const sessions = data.sessions || data || [];

        if (!Array.isArray(sessions) || sessions.length === 0) {
          hasMore = false;
          break;
        }

        for (const s of sessions) {
          const externalId = String(s.id || s.uniqueId || "");
          if (!externalId || seenIds.has(externalId)) continue;
          seenIds.add(externalId);

          const hasCdr = !!(s.cdr || s.conversationSeconds > 0);

          allSessions.push({
            externalId,
            integrationType: "adversus",
            dialerName: this.dialerName,
            leadExternalId: s.leadId ? String(s.leadId) : undefined,
            agentExternalId: s.userId ? String(s.userId) : undefined,
            campaignExternalId: s.campaignId ? String(s.campaignId) : undefined,
            status: s.status || "unknown",
            startTime: s.startTime || s.created || undefined,
            endTime: s.endTime || undefined,
            sessionSeconds: s.sessionSeconds || s.durationSeconds || undefined,
            hasCdr,
            cdrDurationSeconds: s.cdr?.durationSeconds || s.conversationSeconds || undefined,
            cdrDisposition: s.cdr?.disposition || s.disposition || undefined,
            metadata: {
              callType: s.type,
              hangupCause: s.hangupCause,
            },
          });
        }

        console.log(`[Adversus] Sessions page ${page}: ${sessions.length} records (total unique: ${allSessions.length})`);

        if (sessions.length < pageSize) {
          hasMore = false;
        } else {
          page++;
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        console.error(`[Adversus] Error fetching sessions page ${page}:`, e);
        hasMore = false;
      }
    }

    // Log status distribution
    const statusCounts = new Map<string, number>();
    for (const s of allSessions) {
      statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1);
    }
    console.log(`[Adversus] Sessions fetched: ${allSessions.length} total. Status distribution: ${JSON.stringify(Object.fromEntries(statusCounts))}`);

    return allSessions;
  }
}
