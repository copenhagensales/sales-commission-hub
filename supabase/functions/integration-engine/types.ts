export interface StandardProduct {
  name: string;
  externalId: string;
  quantity: number;
  unitPrice: number;
  metadata?: Record<string, unknown>;
}

// Product extraction configuration - stored in dialer_integrations.config
export interface ProductExtractionConfig {
  strategy: 'standard_closure' | 'data_keys_regex' | 'specific_fields';
  regexPattern?: string;     // For extracting (Name) and (Price) from a string key
  targetKeys?: string[];     // Array of keys to search in the 'data' object
  defaultName?: string;      // Fallback product name if nothing found
  validationKey?: string;    // If set, products are only extracted if this key exists and has a value
}

// Full dialer integration config stored in JSONB
export interface DialerIntegrationConfig {
  productExtraction?: ProductExtractionConfig;
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
  campaignName?: string;
  // Explicit external reference (OPP number) - extracted by adapter
  externalReference?: string | null;
  // Client campaign ID - resolved by adapter
  clientCampaignId?: string | null;
  products: StandardProduct[];
  // Complete raw JSON payload from dialer for debugging/auditing
  rawPayload?: Record<string, unknown>;
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

// GDPR-Compliant Call Detail Record (CDR)
// Only contains identifiers and metadata - NO personal data from Lead
export interface StandardCall {
  // Identificadores únicos
  externalId: string;           // ID único de la llamada (CDR)
  integrationType: 'adversus' | 'enreach' | 'other';
  dialerName: string;

  // Temporalidad
  startTime: string;            // Hora de inicio (ISO-8601)
  endTime: string;              // Hora de fin (ISO-8601)

  // Métricas de Telefonía
  durationSeconds: number;      // Duración de la conversación (hablada/billsec)
  totalDurationSeconds: number; // Duración total del registro (incl. timbrado)
  
  // Estatus Unificado
  status: 'ANSWERED' | 'NO_ANSWER' | 'BUSY' | 'FAILED' | 'OTHER'; 
  
  // Referencias Anónimas (IDs - GDPR Compliant)
  agentExternalId: string;      // ID del agente (para cruce con StandardUser)
  campaignExternalId: string;   // ID de la campaña (para cruce con StandardCampaign)
  leadExternalId: string;       // ID del lead (para cruce posterior con SALE)

  // Grabación (opcional)
  recordingUrl?: string;        // URL directa o token para obtener la grabación

  // Metadatos (Campos específicos brutos, si se necesitan para debugging)
  metadata?: Record<string, unknown>;
}
