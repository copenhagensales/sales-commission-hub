export interface StandardSale {
  externalId: string;
  sourceSystem: "adversus" | "enreach" | "other";
  saleDate: string;
  agentEmail: string;
  agentExternalId?: string;
  agentName?: string;
  customerName?: string;
  customerPhone?: string;
  products: StandardProduct[];
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
}

export interface StandardCampaign {
  externalId: string;
  name: string;
  isActive: boolean;
}

export interface StandardProduct {
  name: string;
  externalId: string;
  quantity: number;
  unitPrice: number;
  metadata?: Record<string, any>;
}
