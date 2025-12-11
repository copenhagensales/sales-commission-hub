import { WebhookParser, StandardWebhookPayload, StandardWebhookProduct } from "./interface.ts";

/**
 * Enreach (formerly Benemen) webhook payload structure
 * Based on official documentation: https://doc.enreachvoice.com/webhooks/
 * 
 * Webhooks are configured by Enreach support, not self-service.
 * Headers: X-Benemen-Event (event type), X-Benemen-Token (secret)
 * 
 * Common events:
 * - QueueCallInConnected: Inbound call connected
 * - QueueCallInAllocated: Call allocated to agent
 * - QueueCallInUserAllocated: Call allocated to specific user
 * - QueueCallInCompleted: Call completed
 * - QueueCallOutConnected: Outbound call connected
 * - QueueCallOutCompleted: Outbound call completed
 * - CallListCallCompleted: Call list call completed (sales relevant)
 */
interface EnreachWebhookPayload {
  // Common properties (all events)
  Id: string;
  Timestamp: string;
  RootEntityType: string; // "Organization"
  RootEntityId: string;
  EntityType: string; // "User", "Queue", "CallList"
  EntityId: string;
  EventType: string;
  
  // Call-specific fields
  CallId?: string;
  QueueId?: string;
  QueueName?: string;
  QueueNumber?: string;
  UserId?: string;
  Username?: string; // Often the agent email
  CallerNumber?: string;
  TargetNumber?: string;
  OrganizationId?: string;
  
  // Call result fields
  Duration?: number;
  Result?: string; // Call result/outcome
  ResultCode?: string;
  
  // Call list / outbound specific
  CallListId?: string;
  CallListName?: string;
  ContactId?: string;
  
  // Variables can contain custom data from the call
  Variables?: Record<string, unknown>;
  CallVariables?: Record<string, unknown>;
  Data?: Record<string, unknown>;
  
  // Additional data that might be present
  [key: string]: unknown;
}

/**
 * Our custom contentTemplate format (used when creating webhooks via API)
 */
interface EnreachCustomPayload {
  event: string;
  leadId?: string;
  campaignCode?: string;
  agentEmail?: string;
  agentName?: string;
  leadStatus?: string;
  leadClosure?: string;
  phone?: string;
  company?: string;
  externalId?: string;
  customFields?: string; // JSON string
  createdDate?: string;
  modifiedDate?: string;
}

export class EnreachWebhookParser implements WebhookParser {
  
  canHandle(rawBody: string, contentType: string, headers: Headers): boolean {
    // Primary: Enreach sends X-Benemen-Event header
    const eventHeader = headers.get('X-Benemen-Event');
    if (eventHeader) {
      // Verify we can actually parse the body as JSON
      try {
        JSON.parse(rawBody);
        console.log(`[EnreachParser] Detected via X-Benemen-Event: ${eventHeader}`);
        return true;
      } catch {
        console.log(`[EnreachParser] X-Benemen-Event header present but body is not valid JSON`);
        return false;
      }
    }
    
    // Secondary: Check for Enreach-specific JSON structure
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(rawBody);
        // Enreach payloads always have RootEntityType and EntityType
        if (json.RootEntityType && json.EntityType && json.EventType) {
          console.log(`[EnreachParser] Detected via payload structure: ${json.EventType}`);
          return true;
        }
        // Check for our custom contentTemplate format
        if (json.event === 'lead_closed' && (json.leadId || json.campaignCode)) {
          console.log(`[EnreachParser] Detected via custom contentTemplate format`);
          return true;
        }
      } catch {
        return false;
      }
    }
    
    return false;
  }

  parse(rawBody: string, _contentType: string, headers: Headers): StandardWebhookPayload {
    let body: EnreachWebhookPayload | EnreachCustomPayload;
    
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error(`[EnreachParser] Failed to parse JSON body: ${rawBody.substring(0, 200)}`);
      throw new Error(`Invalid JSON payload for Enreach webhook: ${e}`);
    }
    
    // Check if this is our custom contentTemplate format
    if ('event' in body && body.event === 'lead_closed') {
      return this.parseCustomFormat(body as EnreachCustomPayload);
    }
    
    // Otherwise, parse the native Enreach format
    return this.parseNativeFormat(body as EnreachWebhookPayload, headers);
  }

  private parseCustomFormat(body: EnreachCustomPayload): StandardWebhookPayload {
    console.log(`[EnreachParser] Processing custom format - leadId: ${body.leadId}, campaign: ${body.campaignCode}`);
    
    // Parse customFields if present (it's a JSON string)
    let customFields: Record<string, unknown> = {};
    if (body.customFields) {
      try {
        customFields = JSON.parse(body.customFields);
      } catch {
        console.log(`[EnreachParser] Could not parse customFields JSON`);
      }
    }
    
    // External reference from externalId or customFields
    let externalReference: string | null = body.externalId || null;
    if (!externalReference && customFields) {
      externalReference = String(
        customFields.OrderId || 
        customFields.OPP || 
        customFields.Reference || 
        customFields.SerioID ||
        ''
      ) || null;
    }
    
    console.log(`[EnreachParser] Custom format extracted - Agent: ${body.agentName}, Campaign: ${body.campaignCode}, Phone: ${body.phone}, Ref: ${externalReference}`);
    
    return {
      externalId: body.leadId || `enreach-${Date.now()}`,
      eventType: body.event || 'lead_closed',
      eventTime: body.modifiedDate || body.createdDate || new Date().toISOString(),
      
      agentId: '',
      agentName: body.agentName || '',
      agentEmail: body.agentEmail || '',
      
      campaignId: body.campaignCode || '',
      campaignName: body.campaignCode || '', // HeroBase uses code as name
      
      customerPhone: body.phone || '',
      customerCompany: body.company || '',
      
      externalReference,
      
      products: [], // Products not in webhook, need API fetch
      
      rawPayload: { ...body, customFields } as unknown as Record<string, unknown>,
    };
  }

  private parseNativeFormat(body: EnreachWebhookPayload, headers: Headers): StandardWebhookPayload {
    // Get event type from header (preferred) or body
    const eventType = headers.get('X-Benemen-Event') || body.EventType || 'unknown';
    
    console.log(`[EnreachParser] Processing native format - event: ${eventType}`);
    console.log(`[EnreachParser] EntityType: ${body.EntityType}, Id: ${body.Id}`);
    
    // External ID - use call or contact identifiers
    const externalId = body.CallId || body.ContactId || body.EntityId || body.Id || `enreach-${Date.now()}`;
    
    // Agent info - UserId and Username are the primary fields
    const agentId = body.UserId || '';
    const agentName = body.Username || ''; // Username is often the email in Enreach
    const agentEmail = body.Username || ''; // Username typically IS the email
    
    // Campaign/Queue info
    const campaignId = body.CallListId || body.QueueId || '';
    const campaignName = body.CallListName || body.QueueName || '';
    
    // Customer phone - CallerNumber for inbound, TargetNumber for outbound
    const customerPhone = body.CallerNumber || body.TargetNumber || '';
    
    // Try to extract additional data from Variables
    const variables = body.Variables || body.CallVariables || body.Data || {};
    
    // Customer company from variables
    let customerCompany = '';
    if (variables) {
      customerCompany = String(
        variables.Company || 
        variables.company || 
        variables.CustomerName ||
        variables.customerName ||
        variables.Firma ||
        variables.firma ||
        ''
      );
    }
    
    // External reference (OPP, order number, etc.) from variables
    let externalReference: string | null = null;
    if (variables) {
      // Check common field names for order/reference IDs
      const refValue = 
        variables.OrderId ||
        variables.orderId ||
        variables.OPP ||
        variables.opp ||
        variables.Reference ||
        variables.reference ||
        variables.SerioID ||
        variables.KVHXR ||
        variables.OrderNumber ||
        variables.orderNumber ||
        null;
      
      if (refValue) {
        externalReference = String(refValue);
        console.log(`[EnreachParser] Found reference in variables: ${externalReference}`);
      }
      
      // If still no reference, search all variables for OPP-like patterns
      if (!externalReference) {
        for (const [key, value] of Object.entries(variables)) {
          if (value && typeof value === 'string') {
            const oppMatch = value.match(/\b(OPP-?\d+|\d{6,})\b/i);
            if (oppMatch) {
              externalReference = oppMatch[1];
              console.log(`[EnreachParser] Found OPP pattern in ${key}: ${externalReference}`);
              break;
            }
          }
        }
      }
    }
    
    // Products - Enreach webhooks typically don't include product data
    // Products would need to be fetched via API or from variables
    const products: StandardWebhookProduct[] = [];
    
    // Check if there's product info in variables
    if (variables.Products && Array.isArray(variables.Products)) {
      for (const p of variables.Products) {
        products.push({
          externalId: String(p.Id || p.id || 'unknown'),
          title: String(p.Name || p.name || p.Title || p.title || 'Unknown Product'),
          quantity: Number(p.Quantity || p.quantity || 1),
          unitPrice: Number(p.Price || p.price || p.UnitPrice || 0),
        });
      }
    }
    
    // Log what we extracted for debugging
    console.log(`[EnreachParser] Native format extracted - Agent: ${agentName}, Campaign: ${campaignName}, Phone: ${customerPhone}, Ref: ${externalReference}`);
    
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
