import { WebhookParser, StandardWebhookPayload, StandardWebhookProduct } from "./interface.ts";

/**
 * Enreach webhook payload structure
 * Based on https://doc.enreachvoice.com/webhooks/
 */
interface EnreachWebhookPayload {
  Id: string;
  Timestamp: string;
  RootEntityType: string;
  RootEntityId: string;
  EntityType: string;
  EntityId: string;
  EventType: string;
  
  // Call-specific fields
  CallId?: string;
  QueueId?: string;
  QueueName?: string;
  QueueNumber?: string;
  UserId?: string;
  Username?: string;
  CallerNumber?: string;
  TargetNumber?: string;
  OrganizationId?: string;
  
  // Additional fields for different event types
  Duration?: number;
  Result?: string;
  Variables?: Record<string, unknown>;
  CallVariables?: Record<string, unknown>;
  Data?: Record<string, unknown>;
  
  // HeroBase specific
  LeadId?: string;
  CampaignId?: string;
  CampaignName?: string;
  AgentId?: string;
  AgentName?: string;
  AgentEmail?: string;
  Phone?: string;
  Company?: string;
  Products?: Array<{
    Id?: string;
    Name?: string;
    Quantity?: number;
    Price?: number;
  }>;
}

export class EnreachWebhookParser implements WebhookParser {
  
  canHandle(_rawBody: string, contentType: string, headers: Headers): boolean {
    // Enreach sends X-Benemen-Event header
    const eventHeader = headers.get('X-Benemen-Event');
    if (eventHeader) {
      return true;
    }
    
    // Check for Enreach-specific JSON structure
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(_rawBody);
        // Enreach payloads have RootEntityType and EntityType
        return json.RootEntityType && json.EntityType;
      } catch {
        return false;
      }
    }
    
    return false;
  }

  parse(rawBody: string, _contentType: string, headers: Headers): StandardWebhookPayload {
    const body: EnreachWebhookPayload = JSON.parse(rawBody);
    
    // Get event type from header or body
    const eventType = headers.get('X-Benemen-Event') || body.EventType || 'unknown';
    
    console.log(`[EnreachParser] Event type: ${eventType}`);
    
    // Extract external ID - prioritize CallId, LeadId, or EntityId
    const externalId = body.CallId || body.LeadId || body.EntityId || body.Id || `enreach-${Date.now()}`;
    
    // Extract agent info - Enreach uses UserId/Username
    const agentId = body.UserId || body.AgentId || '';
    const agentName = body.AgentName || body.Username || '';
    const agentEmail = body.AgentEmail || body.Username || ''; // Username is often email in Enreach
    
    // Campaign info
    const campaignId = body.CampaignId || body.QueueId || '';
    const campaignName = body.CampaignName || body.QueueName || '';
    
    // Customer info - CallerNumber for phone, check Data/Variables for company
    const customerPhone = body.CallerNumber || body.Phone || body.TargetNumber || '';
    let customerCompany = body.Company || '';
    
    // Try to get company from Variables or Data
    const variables = body.Variables || body.CallVariables || body.Data || {};
    if (!customerCompany && variables) {
      customerCompany = String(
        variables.Company || 
        variables.company || 
        variables.CustomerName ||
        variables.customerName ||
        ''
      );
    }
    
    // External reference - check Variables/Data for order IDs
    let externalReference: string | null = null;
    if (variables) {
      externalReference = String(
        variables.OrderId ||
        variables.orderId ||
        variables.OPP ||
        variables.Reference ||
        variables.reference ||
        variables.SerioID ||
        variables.KVHXR ||
        ''
      ) || null;
      
      // If still no reference, search for OPP pattern
      if (!externalReference) {
        for (const [key, value] of Object.entries(variables)) {
          if (value && typeof value === 'string') {
            // Look for OPP-like patterns
            const oppMatch = value.match(/\b(OPP-?\d+|\d{6,})\b/i);
            if (oppMatch) {
              externalReference = oppMatch[1];
              console.log(`[EnreachParser] Found OPP in ${key}: ${externalReference}`);
              break;
            }
          }
        }
      }
    }
    
    // Products
    const products: StandardWebhookProduct[] = (body.Products || []).map(p => ({
      externalId: p.Id || 'unknown',
      title: p.Name || 'Unknown Product',
      quantity: p.Quantity || 1,
      unitPrice: p.Price || 0,
    }));
    
    return {
      externalId,
      eventType,
      eventTime: body.Timestamp || new Date().toISOString(),
      
      agentId,
      agentName,
      agentEmail,
      
      campaignId,
      campaignName,
      
      customerPhone,
      customerCompany,
      
      externalReference,
      
      products,
      
      rawPayload: body as unknown as Record<string, unknown>,
    };
  }
}
