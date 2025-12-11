import { WebhookParser, StandardWebhookPayload } from "./interface.ts";

/**
 * HeroBase SimpleLead webhook payload structure
 * This is the actual format sent by HeroBase webhooks
 * 
 * Example payload:
 * {
 *   "uniqueId": "1S3064",
 *   "campaignId": "CAMP2048S3064",
 *   "status": "UserProcessed",
 *   "closure": "Success",
 *   "lastModifiedUser": "new_API@cphsales.dk",
 *   ...
 * }
 */
interface HeroBaseLeadPayload {
  uniqueId?: string;
  UniqueId?: string;
  nextDialTime?: string;
  orgCode?: string;
  campaignId?: string;
  CampaignId?: string;
  campaignCode?: string;
  CampaignCode?: string;
  campaignName?: string;
  CampaignName?: string;
  status?: string;
  Status?: string;
  closure?: string;
  Closure?: string;
  priority?: string;
  lastModifiedTime?: string;
  lastModifiedUser?: string;
  firstProcessedByUser?: string;
  firstProcessedTime?: string;
  uploadTime?: string;
  data?: Record<string, string> | string;
  
  // Agent fields
  agentEmail?: string;
  AgentEmail?: string;
  userName?: string;
  UserName?: string;
  
  // Customer fields
  phoneNumber?: string;
  PhoneNumber?: string;
  contactName?: string;
  ContactName?: string;
  company?: string;
  Company?: string;
  
  // Result fields
  result?: string;
  Result?: string;
  closedDate?: string;
  ClosedDate?: string;
  
  // Allow any additional fields
  [key: string]: unknown;
}

export class EnreachWebhookParser implements WebhookParser {
  
  canHandle(rawBody: string, contentType: string, headers: Headers): boolean {
    // Primary: Enreach sends X-Benemen-Event header
    const eventHeader = headers.get('X-Benemen-Event');
    if (eventHeader) {
      try {
        JSON.parse(rawBody);
        console.log(`[EnreachParser] Detected via X-Benemen-Event: ${eventHeader}`);
        return true;
      } catch {
        console.log(`[EnreachParser] X-Benemen-Event header present but body is not valid JSON`);
        return false;
      }
    }
    
    // Secondary: Check for HeroBase SimpleLead payload structure
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(rawBody);
        // HeroBase payloads have uniqueId and typically campaignId or status
        if (json.uniqueId && (json.campaignId || json.status || json.closure)) {
          console.log(`[EnreachParser] Detected HeroBase SimpleLead payload: uniqueId=${json.uniqueId}`);
          return true;
        }
        // Also check for uppercase variants
        if (json.UniqueId && (json.CampaignId || json.Status || json.Closure)) {
          console.log(`[EnreachParser] Detected HeroBase payload (PascalCase): UniqueId=${json.UniqueId}`);
          return true;
        }
      } catch {
        return false;
      }
    }
    
    return false;
  }

  parse(rawBody: string, _contentType: string, headers: Headers): StandardWebhookPayload {
    let body: HeroBaseLeadPayload;
    
    try {
      body = JSON.parse(rawBody);
    } catch (e) {
      console.error(`[EnreachParser] Failed to parse JSON body: ${rawBody.substring(0, 200)}`);
      throw new Error(`Invalid JSON payload for Enreach webhook: ${e}`);
    }
    
    // Get event type from header or derive from payload
    const eventHeader = headers.get('X-Benemen-Event');
    const eventType = eventHeader || this.getStr(body, ['status', 'Status']) || 'HeroBaseLead';
    
    console.log(`[EnreachParser] Processing event: ${eventType}`);
    console.log(`[EnreachParser] Payload keys: ${Object.keys(body).join(', ')}`);
    
    // External ID - uniqueId is the primary identifier
    const externalId = this.getStr(body, ['uniqueId', 'UniqueId']) || `enreach-${Date.now()}`;
    
    // Agent info - check multiple possible field names
    const agentEmail = this.getStr(body, ['agentEmail', 'AgentEmail', 'lastModifiedUser', 'firstProcessedByUser']);
    const agentName = this.getStr(body, ['userName', 'UserName', 'agentName', 'AgentName']) || agentEmail;
    
    // Campaign info
    const campaignId = this.getStr(body, ['campaignId', 'CampaignId', 'campaignCode', 'CampaignCode']);
    const campaignName = this.getStr(body, ['campaignName', 'CampaignName']) || campaignId;
    
    // Customer info
    const customerPhone = this.getStr(body, ['phoneNumber', 'PhoneNumber', 'phone', 'Phone']);
    const customerCompany = this.getStr(body, ['company', 'Company', 'contactName', 'ContactName']);
    
    // Result/closure info
    const result = this.getStr(body, ['result', 'Result', 'closure', 'Closure']);
    
    // Timestamp - parse HeroBase date format (DD-MM-YYYY HH:mm:ss)
    const rawTime = this.getStr(body, ['closedDate', 'ClosedDate', 'lastModifiedTime', 'firstProcessedTime']);
    const eventTime = this.parseHeroBaseDate(rawTime) || new Date().toISOString();
    
    // Try to extract external reference from data field
    let externalReference: string | null = null;
    const dataField = body.data;
    if (dataField && typeof dataField === 'object') {
      // Check common field names for order/reference IDs
      externalReference = this.getStr(dataField as Record<string, unknown>, [
        'OrderId', 'orderId', 'OPP', 'opp', 'Reference', 'reference',
        'SerioID', 'KVHXR', 'OrderNumber', 'orderNumber'
      ]) || null;
      
      // Search for OPP pattern in data values
      if (!externalReference) {
        for (const [key, value] of Object.entries(dataField)) {
          if (value && typeof value === 'string') {
            const oppMatch = value.match(/\b(OPP-?\d+|\d{6,})\b/i);
            if (oppMatch) {
              externalReference = oppMatch[1];
              console.log(`[EnreachParser] Found OPP pattern in data.${key}: ${externalReference}`);
              break;
            }
          }
        }
      }
    }
    
    // Log extracted values for debugging
    console.log(`[EnreachParser] Extracted values:`);
    console.log(`  - externalId: ${externalId}`);
    console.log(`  - agentEmail: ${agentEmail}`);
    console.log(`  - agentName: ${agentName}`);
    console.log(`  - campaignId: ${campaignId}`);
    console.log(`  - customerPhone: ${customerPhone}`);
    console.log(`  - customerCompany: ${customerCompany}`);
    console.log(`  - result: ${result}`);
    console.log(`  - externalReference: ${externalReference}`);
    console.log(`  - eventTime: ${eventTime}`);
    
    return {
      externalId,
      eventType,
      eventTime,
      
      agentId: agentEmail, // Use email as ID
      agentName,
      agentEmail,
      
      campaignId,
      campaignName,
      
      customerPhone,
      customerCompany,
      
      externalReference,
      
      products: [], // HeroBase webhooks typically don't include product data inline
      
      rawPayload: body as unknown as Record<string, unknown>,
    };
  }
  
  /**
   * Helper to get string value with multiple possible field names
   */
  private getStr(obj: Record<string, unknown> | null | undefined, keys: string[], fallback = ""): string {
    if (!obj) return fallback;
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return fallback;
  }
  
  /**
   * Parse HeroBase date format (DD-MM-YYYY HH:mm:ss) to ISO string
   */
  private parseHeroBaseDate(dateStr: string): string | null {
    if (!dateStr) return null;
    
    // Try parsing DD-MM-YYYY HH:mm:ss format
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      const [, day, month, year, hour, minute, second] = match;
      return new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`).toISOString();
    }
    
    // Try parsing as ISO or other standard format
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    } catch {
      // Ignore parse errors
    }
    
    return null;
  }
}
