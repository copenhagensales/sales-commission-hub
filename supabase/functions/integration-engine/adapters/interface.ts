import { StandardSale, StandardUser, StandardCampaign, StandardProduct, StandardCall, CampaignMappingConfig } from "../types.ts";

export interface DialerAdapter {
  // Campaign mappings are passed to fetchSales so the adapter can extract external references
  fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]>;
  fetchUsers(): Promise<StandardUser[]>;
  fetchCampaigns(): Promise<StandardCampaign[]>;
  fetchProducts?(): Promise<StandardProduct[]>;
  // GDPR-Compliant call data extraction - only IDs and metadata, no personal Lead data
  fetchCalls?(days: number): Promise<StandardCall[]>;
}
