import { StandardSale, StandardUser, StandardCampaign, StandardProduct, CampaignMappingConfig } from "../types.ts";

export interface DialerAdapter {
  // Campaign mappings are passed to fetchSales so the adapter can extract external references
  fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]>;
  fetchUsers(): Promise<StandardUser[]>;
  fetchCampaigns(): Promise<StandardCampaign[]>;
  fetchProducts?(): Promise<StandardProduct[]>;
}
