export interface StandardProduct {
  name: string;
  externalId: string;
  quantity: number;
  unitPrice: number;
}

export interface StandardSale {
  externalId: string;
  sourceSystem: 'adversus' | 'enreach' | 'other';
  saleDate: string;
  agentEmail: string;
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
