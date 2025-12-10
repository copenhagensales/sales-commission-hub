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

    // Paginación segura para obtener ventas
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
      await new Promise((r) => setTimeout(r, 100));
    }

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

  // Nueva estrategia: Construir mapa leadId -> OPP desde /leads con filtros por campaña
  private async buildLeadOppMap(
    sales: any[], 
    campaignConfigMap: Map<string, CampaignMappingConfig>
  ): Promise<Map<string, string>> {
    const leadIdToOpp = new Map<string, string>();

    // 1. Obtener campaignIds únicos de las ventas
    const campaignIds = [...new Set(sales.map(s => s.campaignId).filter(Boolean))];
    console.log(`[Adversus] Found ${campaignIds.length} unique campaigns in sales`);

    // 2. Para cada campaña, obtener leads con filtro y extraer OPPs
    for (const campaignId of campaignIds) {
      const campaignIdStr = String(campaignId);
      const config = campaignConfigMap.get(campaignIdStr);
      
      // Determinar qué field ID usar para OPP
      let oppFieldId: string | null = null;
      
      if (config?.referenceConfig?.type === 'field_id') {
        // Usar el field configurado (puede ser "result_80862" o solo "80862")
        oppFieldId = config.referenceConfig.value.replace('result_', '');
      } else {
        // Default: usar field 80862 (campo OPP común en TDC)
        oppFieldId = '80862';
      }

      try {
        const filters = JSON.stringify({ campaignId: { "$eq": campaignId } });
        const url = `${this.baseUrl}/leads?filters=${encodeURIComponent(filters)}&pageSize=5000`;
        
        console.log(`[Adversus] Fetching leads for campaign ${campaignId}...`);
        const res = await fetch(url, { 
          headers: { Authorization: `Basic ${this.authHeader}`, "Content-Type": "application/json" } 
        });

        if (!res.ok) {
          console.log(`[Adversus] Failed to fetch leads for campaign ${campaignId}: ${res.status}`);
          continue;
        }

        const data = await res.json();
        const leads = data.leads || data || [];
        let oppsFound = 0;

        for (const lead of leads) {
          const leadId = String(lead.id);
          const resultData = lead.resultData || [];
          
          // Buscar OPP en resultData
          let oppValue: string | null = null;
          
          if (Array.isArray(resultData)) {
            for (const field of resultData) {
              if (String(field.id) === oppFieldId && field.value) {
                const val = String(field.value).trim();
                if (this.isValidOppNumber(val)) {
                  oppValue = val;
                  break;
                }
              }
            }
          }

          // Fallback: buscar patrón OPP-XXXXX en cualquier campo
          if (!oppValue && Array.isArray(resultData)) {
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

          if (oppValue) {
            leadIdToOpp.set(leadId, oppValue);
            oppsFound++;
          }
        }

        console.log(`[Adversus] Campaign ${campaignId}: ${leads.length} leads, ${oppsFound} OPPs found`);
        
        // Pequeño delay entre campañas
        await new Promise(r => setTimeout(r, 100));
        
      } catch (e) {
        console.error(`[Adversus] Error fetching leads for campaign ${campaignId}:`, e);
      }
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
