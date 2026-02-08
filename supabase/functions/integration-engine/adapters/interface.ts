import { StandardSale, StandardUser, StandardCampaign, StandardProduct, StandardCall, CampaignMappingConfig, DateRange } from "../types.ts";

export interface DialerAdapter {
  // Campaign mappings are passed to fetchSales so the adapter can extract external references
  fetchSales(days: number, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]>;
  fetchSalesRange?(range: DateRange, campaignMappings?: CampaignMappingConfig[]): Promise<StandardSale[]>;
  fetchUsers(): Promise<StandardUser[]>;
  fetchCampaigns(): Promise<StandardCampaign[]>;
  fetchProducts?(): Promise<StandardProduct[]>;
  // GDPR-Compliant call data extraction - only IDs and metadata, no personal Lead data
  fetchCalls?(days: number): Promise<StandardCall[]>;
  fetchCallsRange?(range: DateRange): Promise<StandardCall[]>;
  // Lightweight raw sales fetch for field sampling (skips lead enrichment)
  fetchSalesRaw?(limit?: number): Promise<Record<string, unknown>[]>;
}
