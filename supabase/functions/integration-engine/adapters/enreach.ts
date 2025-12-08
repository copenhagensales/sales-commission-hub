import { DialerAdapter } from "./interface.ts";
import { StandardSale, StandardUser, StandardCampaign } from "../types.ts";

export class EnreachAdapter implements DialerAdapter {
  private apiKey: string;
  private baseUrl: string; 

  // Recibe credenciales desde la DB
  constructor(credentials: { api_key?: string; base_url?: string }) {
    if (!credentials.api_key || !credentials.base_url) {
      throw new Error("Credenciales Enreach incompletas en la configuración");
    }
    this.apiKey = credentials.api_key;
    this.baseUrl = credentials.base_url;
  }

  async fetchSales(days: number): Promise<StandardSale[]> {
    console.log(`[Enreach] Fetching last ${days} days...`);
    
    // TODO: Implementar cuando tengamos documentación de endpoints
    return []; 
  }

  async fetchUsers(): Promise<StandardUser[]> {
    return [];
  }

  async fetchCampaigns(): Promise<StandardCampaign[]> {
    return [];
  }
}
