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

    // OPTIMIZACIÓN: Fetch paralelo de páginas (10 páginas a la vez)
    const rawSales = await this.fetchSalesParallel(filterStr);
    console.log(`[Adversus] Fetched ${rawSales.length} sales via parallel fetch`);

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

  // Nueva estrategia: Construir mapa leadId -> OPP desde /leads con filtros por campaña (PARALELO)
  private async buildLeadOppMap(
    sales: any[], 
    campaignConfigMap: Map<string, CampaignMappingConfig>
  ): Promise<Map<string, string>> {
    const leadIdToOpp = new Map<string, string>();

    // 1. Obtener campaignIds únicos de las ventas
    const campaignIds = [...new Set(sales.map(s => s.campaignId).filter(Boolean))];
    console.log(`[Adversus] Found ${campaignIds.length} unique campaigns, fetching leads in parallel...`);

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

    // 3. Fetch paralelo de leads por campaña (todas las campañas a la vez)
    const fetchPromises = campaignConfigs.map(async ({ campaignId, oppFieldId }) => {
      try {
        const filters = JSON.stringify({ campaignId: { "$eq": campaignId } });
        const url = `${this.baseUrl}/leads?filters=${encodeURIComponent(filters)}&pageSize=5000`;
        
        const res = await fetch(url, { 
          headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" } 
        });

        if (!res.ok) {
          console.log(`[Adversus] Failed to fetch leads for campaign ${campaignId}: ${res.status}`);
          return { campaignId, leads: [], oppsFound: 0 };
        }

        const data = await res.json();
        const leads = data.leads || data || [];
        let oppsFound = 0;

        for (const lead of leads) {
          const leadId = String(lead.id);
          const resultData = lead.resultData || [];
          let oppValue: string | null = null;
          
          if (Array.isArray(resultData)) {
            // Buscar en el field configurado
            for (const field of resultData) {
              if (String(field.id) === oppFieldId && field.value) {
                const val = String(field.value).trim();
                if (this.isValidOppNumber(val)) {
                  oppValue = val;
                  break;
                }
              }
            }
            
            // Fallback: buscar patrón OPP-XXXXX
            if (!oppValue) {
              for (const field of resultData) {
                if (field.value) {
                  const val = String(field.value).trim();
                  if (val.match(/^OPP-\d{4,6}$/)) {
                    oppValue = val;
                    break;
                  }
                }
              }
            }
          }

          if (oppValue) {
            leadIdToOpp.set(leadId, oppValue);
            oppsFound++;
          }
        }

        return { campaignId, leads: leads.length, oppsFound };
      } catch (e) {
        console.error(`[Adversus] Error fetching leads for campaign ${campaignId}:`, e);
        return { campaignId, leads: 0, oppsFound: 0 };
      }
    });

    // Ejecutar todos los fetches en paralelo
    const results = await Promise.all(fetchPromises);
    
    // Log resultados
    for (const r of results) {
      console.log(`[Adversus] Campaign ${r.campaignId}: ${r.leads} leads, ${r.oppsFound} OPPs`);
    }

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

  // OPTIMIZACIÓN: Fetch paralelo de ventas (10 páginas a la vez)
  private async fetchSalesParallel(filterStr: string): Promise<any[]> {
    const allSales: any[] = [];
    const pageSize = 500;
    const parallelBatch = 10; // 10 páginas en paralelo
    let currentPage = 1;
    let hasMore = true;

    while (hasMore && currentPage <= 100) {
      // Crear batch de promesas para páginas paralelas
      const pagePromises: Promise<any[]>[] = [];
      
      for (let i = 0; i < parallelBatch && currentPage + i <= 100; i++) {
        const page = currentPage + i;
        const url = `${this.baseUrl}/sales?pageSize=${pageSize}&page=${page}&filters=${filterStr}`;
        
        pagePromises.push(
          fetch(url, { headers: { Authorization: `Basic ${this.authHeader}` } })
            .then(res => res.ok ? res.json() : { sales: [] })
            .then(data => data.sales || data || [])
            .catch(() => [])
        );
      }

      // Ejecutar batch en paralelo
      const results = await Promise.all(pagePromises);
      
      let batchEmpty = true;
      for (const pageData of results) {
        if (pageData.length > 0) {
          allSales.push(...pageData);
          batchEmpty = false;
        }
      }

      // Si alguna página del batch vino vacía, terminamos
      if (batchEmpty || results.some(r => r.length < pageSize)) {
        hasMore = false;
      } else {
        currentPage += parallelBatch;
      }

      console.log(`[Adversus] Parallel fetch: ${allSales.length} sales so far (pages ${currentPage}-${currentPage + parallelBatch - 1})`);
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
