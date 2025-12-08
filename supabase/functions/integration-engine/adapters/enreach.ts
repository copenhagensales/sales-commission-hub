import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign } from "../types.ts";

export class EnreachAdapter implements DialerAdapter {
  private apiKey: string;
  private baseUrl: string; 

  constructor() {
    this.apiKey = Deno.env.get('ENREACH_API_KEY')!;
    this.baseUrl = Deno.env.get('ENREACH_BASE_URL')!;
    
    if (!this.apiKey || !this.baseUrl) throw new Error("Credenciales Enreach faltantes");
  }

  async fetchSales(days: number): Promise<StandardSale[]> {
    console.log(`[Enreach] Fetching last ${days} days...`);
    
    // TODO: Implementar cuando tengamos documentación de endpoints
    // Normalmente GET /orders o GET /calls con estado de venta
    return []; 
  }

  async fetchUsers(): Promise<StandardUser[]> {
    return [];
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    return [];
  }
}
