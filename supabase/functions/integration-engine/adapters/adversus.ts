import { DialerAdapter } from "./interface.ts";
import { StandardSale } from "../types.ts";

export class AdversusAdapter implements DialerAdapter {
  private authHeader: string;
  private baseUrl = 'https://api.adversus.io/v1';

  constructor() {
    const user = Deno.env.get('ADVERSUS_API_USERNAME');
    const pass = Deno.env.get('ADVERSUS_API_PASSWORD');
    if (!user || !pass) throw new Error("Missing Adversus credentials");
    this.authHeader = btoa(`${user}:${pass}`);
  }

  async fetchSales(days: number): Promise<StandardSale[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const filterStr = encodeURIComponent(JSON.stringify({ created: { $gt: startDate.toISOString() } }));
    
    let page = 1;
    let rawSales: any[] = [];
    let hasMore = true;

    while (hasMore && page <= 50) {
      const res = await fetch(`${this.baseUrl}/sales?pageSize=100&page=${page}&filters=${filterStr}`, {
        headers: { 'Authorization': `Basic ${this.authHeader}`, 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) break;
      const data = await res.json();
      const pageData = data.sales || data || [];
      
      if (pageData.length === 0) hasMore = false;
      else {
        rawSales = [...rawSales, ...pageData];
        page++;
      }
      await new Promise(r => setTimeout(r, 100));
    }

    return rawSales.map(s => ({
      externalId: String(s.id),
      sourceSystem: 'adversus' as const,
      saleDate: s.closedTime || s.createdTime,
      agentEmail: s.ownedBy?.email || s.createdBy?.email || 'unknown@adversus.local',
      customerName: s.lead?.company || s.lead?.name,
      customerPhone: s.lead?.phone,
      products: (s.lines || []).map((l: any) => ({
        name: l.title || 'Unknown product',
        externalId: String(l.productId),
        quantity: l.quantity || 1,
        unitPrice: l.unitPrice || 0
      })),
      metadata: { 
        campaignId: s.campaignId,
        leadId: s.leadId
      }
    }));
  }
}
