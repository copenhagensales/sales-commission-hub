import { StandardSale, StandardUser, StandardCampaign, StandardProduct } from "../types.ts";

export interface DialerAdapter {
  fetchSales(days: number): Promise<StandardSale[]>;
  fetchUsers(): Promise<StandardUser[]>;
  fetchCampaigns(): Promise<StandardCampaign[]>;
  fetchProducts?(): Promise<StandardProduct[]>;
}
