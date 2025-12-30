import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign, StandardCall, CampaignMappingConfig, ReferenceExtractionConfig } from "../types.ts";

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

  private async get(endpoint: string) {
    // Use /v1 for standard endpoints
    const res = await fetch(`${this.baseUrl}/v1${endpoint}`, {
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

    // Build campaign lookup maps
    const campaignConfigMap = new Map<string, CampaignMappingConfig>();
    campaignMappings?.forEach(m => campaignConfigMap.set(m.adversusCampaignId, m));

    // Fetch users first to build a user lookup map
    const users = await this.fetchUsers();
    const userMap = new Map<string, StandardUser>();
    users.forEach(u => userMap.set(u.externalId, u));
    console.log(`[Adversus] Loaded ${users.length} users for agent lookup`);

    // Fetch secuencial con pageSize grande (1000) - más estable que paralelo
    const rawSales = await this.fetchSalesSequential(filterStr);
    console.log(`[Adversus] Fetched ${rawSales.length} sales`);

    console.log(`[Adversus] Fetched ${rawSales.length} sales, now building OPP map from leads...`);

    // NUEVA ESTRATEGIA: Obtener OPPs desde /leads con filtros por campaña
    const leadIdToOpp = await this.buildLeadOppMap(rawSales, campaignConfigMap);
    console.log(`[Adversus] Built OPP map with ${leadIdToOpp.size} entries`);

    // Mapeo a StandardSale usando el mapa de OPPs y el mapa de usuarios
    return rawSales.map((s: any) => {
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

      // 4. Final fallback - only if we truly have no email
      if (!agentEmail) {
        agentEmail = `agent-${agentId}@adversus.local`;
        console.log(`[Adversus] Warning: No email found for agent ${agentId}, using fallback`);
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
      if (leadId && leadIdToOpp.has(leadId)) {
        externalReference = leadIdToOpp.get(leadId)!;
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
        customerPhone: s.lead?.phone || "",

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

        // Store complete raw JSON from dialer
        rawPayload: s,

        metadata: {
          campaignId: s.campaignId,
          leadId: s.leadId,
          lead: s.lead,
        },
      };
    });
  }
  async fetchSalesRange(range: { from: string; to: string }, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]> {
    const hasTimeFrom = range.from.includes("T")
    const hasTimeTo = range.to.includes("T")
    const fromDate = new Date(range.from)
    const toDate = new Date(range.to)
    if (!hasTimeFrom) fromDate.setHours(0, 0, 0, 0)
    if (!hasTimeTo) toDate.setHours(23, 59, 59, 999)
    const fromISO = fromDate.toISOString()
    const toISO = toDate.toISOString()
    const filterStr = encodeURIComponent(JSON.stringify({ created: { $gte: fromISO, $lte: toISO } }));
    const campaignConfigMap = new Map<string, CampaignMappingConfig>();
    campaignMappings?.forEach(m => campaignConfigMap.set(m.adversusCampaignId, m));
    const users = await this.fetchUsers();
    const userMap = new Map<string, StandardUser>();
    users.forEach(u => userMap.set(u.externalId, u));
    console.log(`[Adversus] Loaded ${users.length} users for agent lookup`);
    const rawSales = await this.fetchSalesSequential(filterStr);
    console.log(`[Adversus] Fetched ${rawSales.length} sales (range)`);
    const leadIdToOpp = await this.buildLeadOppMap(rawSales, campaignConfigMap);
    console.log(`[Adversus] Built OPP map with ${leadIdToOpp.size} entries`);
    return rawSales.map((s: any) => {
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

      // 4. Final fallback
      if (!agentEmail) {
        agentEmail = `agent-${agentId}@adversus.local`;
      }

      agentName = agentName || "Desconocido";
      const campaignId = s.campaignId ? String(s.campaignId) : undefined;
      const leadId = s.leadId ? String(s.leadId) : undefined;
      let externalReference: string | null = null;
      let clientCampaignId: string | null = null;
      if (campaignId && campaignConfigMap.has(campaignId)) {
        clientCampaignId = campaignConfigMap.get(campaignId)!.clientCampaignId;
      }
      if (leadId && leadIdToOpp.has(leadId)) {
        externalReference = leadIdToOpp.get(leadId)!;
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
        customerPhone: s.lead?.phone || "",
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
        rawPayload: s,
        metadata: {
          campaignId: s.campaignId,
          leadId: s.leadId,
          lead: s.lead,
        },
      };
    });
  }

  // Construir mapa leadId -> OPP desde /leads con filtros por campaña (SECUENCIAL para evitar rate limit)
  private async buildLeadOppMap(
    sales: any[],
    campaignConfigMap: Map<string, CampaignMappingConfig>
  ): Promise<Map<string, string>> {
    const leadIdToOpp = new Map<string, string>();

    // 1. Obtener campaignIds únicos de las ventas
    const campaignIds = [...new Set(sales.map(s => s.campaignId).filter(Boolean))];
    console.log(`[Adversus] Found ${campaignIds.length} unique campaigns, fetching leads SEQUENTIALLY...`);

    // 2. Preparar configs para cada campaña
    const campaignConfigs = campaignIds.map(campaignId => {
      const campaignIdStr = String(campaignId);
      const config = campaignConfigMap.get(campaignIdStr);
      let oppFieldId = '80862'; // Default

      if (config?.referenceConfig?.type === 'field_id') {
        oppFieldId = config.referenceConfig.value.replace('result_', '');
      }

      return { campaignId, oppFieldId };
    });

    // 3. Fetch SECUENCIAL de leads por campaña (evitar rate limit)
    let totalLeads = 0;
    let totalOpps = 0;

    for (const { campaignId, oppFieldId } of campaignConfigs) {
      try {
        const filters = JSON.stringify({ campaignId: { "$eq": campaignId } });
        const url = `${this.baseUrl}/leads?filters=${encodeURIComponent(filters)}&pageSize=5000`;

        const res = await fetch(url, {
          headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" }
        });

        if (!res.ok) {
          console.log(`[Adversus] Campaign ${campaignId}: Failed (${res.status})`);
          // Delay extra si es rate limit
          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 1000));
          }
          continue;
        }

        const data = await res.json();
        const leads = data.leads || data || [];
        let oppsFound = 0;

        // Usar misma lógica que adversus-diagnostics (que funcionó perfectamente)
        const oppPattern = /OPP-\d{4,6}/;

        for (const lead of leads) {
          const leadId = String(lead.id);
          const resultData = lead.resultData || [];

          if (Array.isArray(resultData)) {
            for (const field of resultData) {
              if (field && field.value) {
                const value = String(field.value);
                const match = value.match(oppPattern);
                if (match) {
                  leadIdToOpp.set(leadId, match[0]);
                  oppsFound++;
                  break; // Solo el primer OPP encontrado
                }
              }
            }
          }
        }

        totalLeads += leads.length;
        totalOpps += oppsFound;
        console.log(`[Adversus] Campaign ${campaignId}: ${leads.length} leads, ${oppsFound} OPPs`);

        // Delay entre requests para evitar rate limit
        await new Promise(r => setTimeout(r, 100));
      } catch (e) {
        console.error(`[Adversus] Error fetching leads for campaign ${campaignId}:`, e);
      }
    }

    console.log(`[Adversus] Built OPP map with ${leadIdToOpp.size} entries (from ${totalLeads} leads, ${totalOpps} OPPs found)`);
    return leadIdToOpp;
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

      try {
        const res = await fetch(url, { headers: { Authorization: `Basic ${this.authHeader}` } });

        if (!res.ok) {
          console.log(`[Adversus] Page ${page} failed with status ${res.status}`);
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
            // Pequeño delay para evitar rate limit
            await new Promise(r => setTimeout(r, 50));
          }
        }
      } catch (e) {
        console.error(`[Adversus] Error fetching page ${page}:`, e);
        break;
      }
    }

    return allSales;
  }

  // Fetch leads for a campaign (used by field inspector)
  async fetchLeadsForCampaign(campaignId: string, pageSize = 100): Promise<any[]> {
    try {
      const filters = JSON.stringify({ campaignId: { "$eq": Number(campaignId) } });
      const url = `${this.baseUrl}/leads?filters=${encodeURIComponent(filters)}&pageSize=${pageSize}`;

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
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = new Date().toISOString().split('T')[0];

    console.log(`[Adversus] Fetching calls for last ${days} days (delegating to fetchCallsRange)`);
    return this.fetchCallsRange({ from: startDateStr, to: endDateStr });
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

      let page = 1;
      let hasMore = true;
      let pageSize = 1000;
      let consecutiveEmptyPages = 0;

      console.log(`[Adversus] Trying endpoint base: ${endpointBase}`);

      while (hasMore) {
        let retries = 0;
        const maxRetries = 5;
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
              const waitTime = 2000 * Math.pow(2, retries);
              console.warn(`[Adversus] Rate limit hit (429). Waiting ${waitTime / 1000}s before retry ${retries + 1}/${maxRetries}...`);
              await new Promise(r => setTimeout(r, waitTime));
              retries++;
              continue;
            }

            if (!res.ok) {
              const errorBody = await res.text();
              if (page === 1) {
                console.log(`[Adversus] Endpoint ${endpointBase} failed: ${res.status} - ${errorBody.substring(0, 200)}`);
              } else if (res.status === 404) {
                console.log(`[Adversus] Page ${page} returned 404. Assuming end of data.`);
              } else {
                console.warn(`[Adversus] Page ${page} failed with status ${res.status}.`);
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
              const newRecords = records.filter((r: any) => {
                // 1. Client-Side Date Filter (Safety Net)
                const callDateStr = r.startTime || r.started || r.created || r.insertedTime;
                if (callDateStr) {
                  const callDay = callDateStr.includes('T') ? callDateStr.split('T')[0] : callDateStr.split(' ')[0];
                  if (callDay < startDateStr || callDay > endDateStr) return false;
                }

                const id = String(r.id || r.uniqueId || r.uuid);
                const hash = this.generateRecordHash(r);
                if (id && id !== 'undefined' && seenIds.has(id)) return false;
                if (seenHashes.has(hash)) return false;

                if (id && id !== 'undefined') seenIds.add(id);
                seenHashes.add(hash);
                return true;
              });

              if (newRecords.length > 0) {
                allRecords = allRecords.concat(newRecords);
                consecutiveEmptyPages = 0;
              } else {
                consecutiveEmptyPages++;
                if (consecutiveEmptyPages > 10) {
                  console.warn(`[Adversus] 10 consecutive empty pages. Stopping pagination safety. (Last page: ${page})`);
                  hasMore = false;
                  success = true;
                  break;
                }
              }

              console.log(`[Adversus] Page ${page}: Fetched ${records.length} raw. Unique relevant: ${newRecords.length}. Total unique: ${allRecords.length}`);

              if (records.length < pageSize) {
                hasMore = false;
              } else {
                page++;
                await new Promise(r => setTimeout(r, 500));
              }
            } else {
              console.log(`[Adversus] Page ${page} empty. Stopping.`);
              hasMore = false;
            }
            success = true;
          } catch (e) {
            console.error(`[Adversus] Error page ${page} (Attempt ${retries + 1}):`, e);
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
        console.log(`[Adversus] Finished fetching. Total unique records found: ${allRecords.length}`);
        const mappedCalls = this.mapCdrsToStandardCalls(allRecords);

        // Store debug data for calls
        this.lastDebugData = {
          rawCalls: allRecords,
          processedCalls: mappedCalls.map(c => ({ externalId: c.externalId })),
          skipReasonMap: new Map(),
        };

        return mappedCalls;
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

  // Generate a consistent hash for a record to detect duplicates
  private generateRecordHash(record: any): string {
    const keyData = {
      id: record.id || record.uniqueId || record.uuid,
      startTime: record.startTime || record.started || record.created,
      endTime: record.endTime || record.ended,
      agentId: record.userId || record.agentId || record.ownedBy?.id,
      campaignId: record.campaignId,
      leadId: record.contactId || record.leadId,
      duration: record.conversationSeconds || record.billsec,
    };
    return JSON.stringify(keyData);
  }
}
