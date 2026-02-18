import { StandardSale, StandardUser, StandardCampaign, StandardProduct, StandardCall, StandardSession, CampaignMappingConfig, DateRange } from "../types.ts";

export interface ApiMetrics {
  apiCalls: number;
  rateLimitHits: number;
  retries: number;
}

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
  // Session data extraction - ALL outcomes for hitrate analytics
  fetchSessions?(days: number): Promise<StandardSession[]>;
  fetchSessionsRange?(range: DateRange): Promise<StandardSession[]>;
  // Lightweight raw sales fetch for field sampling (skips lead enrichment)
  fetchSalesRaw?(limit?: number): Promise<Record<string, unknown>[]>;
  // API metrics tracking
  getMetrics(): ApiMetrics;
  resetMetrics(): void;
}
