export interface StandardProduct {
  name: string;
  externalId: string;
  quantity: number;
  unitPrice: number;
  metadata?: Record<string, unknown>;
}

// Reference extraction config stored in DB - flexible for any adapter
export interface ReferenceExtractionConfig {
  type: "field_id" | "json_path" | "regex" | "static";
  value: string;
}

// Campaign mapping with extraction config
export interface CampaignMappingConfig {
  adversusCampaignId: string;
  clientCampaignId: string | null;
  referenceConfig: ReferenceExtractionConfig | null;
}

export interface StandardSale {
  externalId: string;
  // The integration type (adversus, enreach, etc.)
  integrationType: "adversus" | "enreach" | "other";
  // The dialer/account name (e.g., "Lovablecph", "tryg", "try enreach")
  dialerName: string;
  saleDate: string;
  agentEmail: string;
  agentExternalId?: string;
  agentName?: string;
  customerName?: string;
  customerPhone?: string;
  campaignId?: string;
  // Explicit external reference (OPP number) - extracted by adapter
  externalReference?: string | null;
  // Client campaign ID - resolved by adapter
  clientCampaignId?: string | null;
  products: StandardProduct[];
  metadata?: Record<string, unknown>;
}

export interface SyncResult {
  success: boolean;
  processed: number;
  errors: number;
  message: string;
}

export interface StandardUser {
  externalId: string;
  name: string;
  email: string;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

export interface StandardCampaign {
  externalId: string;
  name: string;
  isActive: boolean;
}
