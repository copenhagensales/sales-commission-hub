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

    // Build campaign lookup maps
    const campaignConfigMap = new Map<string, CampaignMappingConfig>();
    campaignMappings?.forEach(m => campaignConfigMap.set(m.adversusCampaignId, m));

    // Fetch secuencial con pageSize grande (1000) - más estable que paralelo
    const rawSales = await this.fetchSalesSequential(filterStr);
    console.log(`[Adversus] Fetched ${rawSales.length} sales`);

    console.log(`[Adversus] Fetched ${rawSales.length} sales, now building OPP map from leads...`);

    // NUEVA ESTRATEGIA: Obtener OPPs desde /leads con filtros por campaña
    const leadIdToOpp = await this.buildLeadOppMap(rawSales, campaignConfigMap);
    console.log(`[Adversus] Built OPP map with ${leadIdToOpp.size} entries`);

    // Mapeo a StandardSale usando el mapa de OPPs
    return rawSales.map((s: any) => {
      const agentObj = s.ownedBy || s.createdBy;
      const agentId = typeof agentObj === "object" ? agentObj.id : agentObj;
      const agentEmail = typeof agentObj === "object" ? agentObj.email : `agent-${agentId}@adversus.local`;
      const agentName = typeof agentObj === "object" ? agentObj.name || agentObj.displayName : "Desconocido";

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
}
