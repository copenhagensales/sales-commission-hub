/**
 * Standard webhook payload - normalized format for all dialer providers
 */
export interface StandardWebhookPayload {
  externalId: string;
  eventType: string;
  eventTime: string;
  
  // Agent info
  agentId: string;
  agentName: string;
  agentEmail: string;
  
  // Campaign info
  campaignId: string;
  campaignName: string;
  
  // Customer info
  customerPhone: string;
  customerCompany: string;
  
  // External reference (OPP number, order ID, etc.)
  externalReference: string | null;
  
  // Products
  products: StandardWebhookProduct[];
  
  // Raw data for debugging
  rawPayload: Record<string, unknown>;
}

export interface StandardWebhookProduct {
  externalId: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Parser interface - all provider parsers must implement this
 */
export interface WebhookParser {
  /**
   * Parse raw request body and headers into standard format
   */
  parse(
    rawBody: string, 
    contentType: string, 
    headers: Headers
  ): StandardWebhookPayload;
  
  /**
   * Detect if this parser can handle the given request
   * Used for auto-detection when provider is unknown
   */
  canHandle(rawBody: string, contentType: string, headers: Headers): boolean;
}
