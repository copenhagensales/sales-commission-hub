import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign } from "../types.ts";

export class AdversusAdapter implements DialerAdapter {
  private authHeader: string;
  private baseUrl = "https://api.adversus.io/v1";

  constructor() {
    const user = Deno.env.get("ADVERSUS_API_USERNAME");
    const pass = Deno.env.get("ADVERSUS_API_PASSWORD");
    if (!user || !pass) throw new Error("Credenciales Adversus faltantes");
    this.authHeader = btoa(`${user}:${pass}`);
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

  async fetchSales(days: number): Promise<StandardSale[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }));

    let page = 1;
    let rawSales: any[] = [];
    let hasMore = true;

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

    // Mapeo a StandardSale
    return rawSales.map((s: any) => {
      // Extraer agente de forma segura
      const agentObj = s.ownedBy || s.createdBy;
      const agentId = typeof agentObj === "object" ? agentObj.id : agentObj;
      const agentEmail = typeof agentObj === "object" ? agentObj.email : `agent-${agentId}@adversus.local`;
      const agentName = typeof agentObj === "object" ? agentObj.name || agentObj.displayName : "Desconocido";

      return {
        externalId: String(s.id),
        sourceSystem: "adversus",
        saleDate: s.closedTime || s.createdTime,

        agentExternalId: String(agentId),
        agentEmail: agentEmail,
        agentName: agentName,

        customerName: s.lead?.company || s.lead?.name || "",
        customerPhone: s.lead?.phone || "",

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
        },
      };
    });
  }
}
