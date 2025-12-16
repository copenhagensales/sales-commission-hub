import { WebhookParser, StandardWebhookPayload, StandardWebhookProduct } from "./interface.ts";

interface AdversusProduct {
  id: number;
  externalId?: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

interface AdversusJsonPayload {
  type: string;
  event_time?: string;
  payload: {
    result_id?: number;
    campaign?: {
      id: string;
      name: string;
    };
    user?: {
      id: string;
      name: string;
      email: string;
    };
    lead?: {
      id: number;
      phone: string;
      company: string;
    };
    products?: AdversusProduct[];
    resultData?: Record<string, unknown>;
  };
}

export class AdversusWebhookParser implements WebhookParser {
  
  canHandle(rawBody: string, contentType: string, headers: Headers): boolean {
    // Check for Adversus-specific patterns
    if (contentType.includes('multipart/form-data')) {
      // Check for Adversus form field names
      return rawBody.includes('leadid') || rawBody.includes('status');
    }
    
    if (contentType.includes('application/json')) {
      try {
        const json = JSON.parse(rawBody);
        // Adversus JSON always has type and payload structure
        return json.type && json.payload;
      } catch {
        return false;
      }
    }
    
    return false;
  }

  parse(rawBody: string, contentType: string, _headers: Headers): StandardWebhookPayload {
    if (contentType.includes('multipart/form-data')) {
      return this.parseFormData(rawBody, contentType);
    }
    
    return this.parseJson(rawBody);
  }

  private parseFormData(rawBody: string, contentType: string): StandardWebhookPayload {
    const formData: Record<string, string> = {};
    const boundary = contentType.split('boundary=')[1];
    
    if (boundary) {
      const parts = rawBody.split(`--${boundary}`);
      for (const part of parts) {
        const match = part.match(/name="([^"]+)"\r\n\r\n([^\r\n]*)/);
        if (match) {
          formData[match[1]] = match[2].trim();
        }
      }
    }
    
    console.log('[AdversusParser] Parsed form data:', JSON.stringify(formData));
    
    const leadId = formData['leadid'] || formData['lead_id'] || '0';
    const externalReference = formData['OPP nr'] || formData['ordre_id'] || formData['orderId'] || null;
    
    // Extract all phone number fields that might exist
    const customerPhone = formData['Live Nummer'] || 
                         formData['Kontakt nummer'] || 
                         formData['Telefonnummer1'] ||
                         formData['phone'] || 
                         formData['telefon'] ||
                         '';
    
    // Extract agent info from form data - more thorough search
    const agentId = formData['userid'] || formData['user_id'] || formData['agentid'] || '';
    const agentName = formData['username'] || formData['user_name'] || formData['agentname'] || '';
    const agentEmail = formData['useremail'] || formData['user_email'] || formData['agentemail'] || '';
    
    // Extract campaign info
    const campaignId = formData['campaign_id'] || formData['campaignid'] || formData['campaign'] || '';
    const campaignName = formData['campaign_name'] || formData['campaignname'] || '';
    
    // Extract customer info
    const customerCompany = formData['company'] || formData['CVR'] || formData['Efternavn'] || '';
    const customerName = formData['NAVN FF Forsikring'] || formData['customer_name'] || formData['navn'] || '';
    
    return {
      externalId: leadId,
      leadId: leadId, // Store leadId explicitly for deduplication
      eventType: formData['status'] || 'leadClosedSuccess',
      eventTime: new Date().toISOString(),
      
      agentId,
      agentName,
      agentEmail,
      
      campaignId,
      campaignName,
      
      customerPhone,
      customerCompany: customerCompany || customerName,
      
      externalReference,
      
      products: [], // Form data doesn't typically include products
      
      rawPayload: formData, // Store ALL form data for debugging
    };
  }

  private parseJson(rawBody: string): StandardWebhookPayload {
    const body: AdversusJsonPayload = JSON.parse(rawBody);
    const payload = body.payload || {};
    
    // Extract external reference from resultData if available
    let externalReference: string | null = null;
    if (payload.resultData) {
      externalReference = String(
        payload.resultData.orderId || 
        payload.resultData.OPP || 
        payload.resultData.oppNumber ||
        ''
      ) || null;
    }
    
    const leadId = payload.lead?.id ? String(payload.lead.id) : undefined;
    
    // Prefer result_id as it's unique per sale, fall back to leadId
    const externalId = String(
      payload.result_id || 
      payload.lead?.id || 
      `webhook-${Date.now()}`
    );

    const products: StandardWebhookProduct[] = (payload.products || []).map(p => ({
      externalId: p.externalId || String(p.id),
      title: p.title,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
    }));

    return {
      externalId,
      leadId, // Store leadId for deduplication with API sync
      eventType: body.type || 'result',
      eventTime: body.event_time || new Date().toISOString(),
      
      agentId: payload.user?.id || '',
      agentName: payload.user?.name || '',
      agentEmail: payload.user?.email || '',
      
      campaignId: payload.campaign?.id || '',
      campaignName: payload.campaign?.name || '',
      
      customerPhone: payload.lead?.phone || '',
      customerCompany: payload.lead?.company || '',
      
      externalReference,
      
      products,
      
      rawPayload: body as unknown as Record<string, unknown>,
    };
  }
}
