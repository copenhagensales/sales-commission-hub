import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseWebhook, StandardWebhookPayload } from "./parsers/factory.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-benemen-token, x-benemen-event',
};

const getDateOnly = (dateStr: string) => {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

// Helper to log to integration_logs table
// deno-lint-ignore no-explicit-any
async function logIntegration(
  supabase: any,
  status: 'success' | 'error' | 'warning',
  message: string,
  details: Record<string, unknown> = {}
) {
  try {
    await supabase.from('integration_logs').insert({
      integration_type: 'dialer',
      integration_name: details.dialer_name || 'Dialer Webhook',
      status,
      message,
      details,
    });
  } catch (err) {
    console.error('Failed to log integration:', err);
  }
}

// Process standard payload into database
// deno-lint-ignore no-explicit-any
async function processWebhookPayload(
  supabase: any,
  payload: StandardWebhookPayload,
  provider: string,
  dialerInfo: { id: string; name: string; provider: string } | null
) {
  const dialerId = dialerInfo?.id || null;
  const dialerName = dialerInfo?.name || 'Unknown Dialer';
  
  // Handle same-day corrections
  const newEventDate = payload.eventTime ? getDateOnly(payload.eventTime) : getDateOnly(new Date().toISOString());

  const { data: existingEvents } = await supabase
    .from('adversus_events')
    .select('id')
    .eq('external_id', payload.externalId);

  let existingSales: { id: string; sale_datetime: string }[] = [];

  if (existingEvents && existingEvents.length > 0) {
    const existingEventIds = existingEvents.map((e: { id: string }) => e.id);
    const { data: salesForResult } = await supabase
      .from('sales')
      .select('id, sale_datetime')
      .in('adversus_event_id', existingEventIds);
    existingSales = salesForResult || [];
  }

  let isSameDayCorrection = false;
  let ignoreNewEvent = false;

  if (existingSales.length > 0) {
    const sortedSales = [...existingSales].sort(
      (a, b) => new Date(a.sale_datetime).getTime() - new Date(b.sale_datetime).getTime()
    );
    const originalSaleDate = getDateOnly(sortedSales[0].sale_datetime);

    if (newEventDate.getTime() === originalSaleDate.getTime()) {
      isSameDayCorrection = true;
    } else {
      ignoreNewEvent = true;
    }
  }

  // Store raw event with dialer reference
  const { data: eventData, error: eventError } = await supabase
    .from('adversus_events')
    .insert({
      external_id: payload.externalId,
      event_type: payload.eventType,
      payload: {
        ...payload.rawPayload,
        _dialer_webhook_info: {
          dialer_id: dialerId,
          dialer_name: dialerName,
          provider: provider,
          received_at: new Date().toISOString(),
        }
      },
      processed: false,
      received_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (eventError) throw eventError;
  console.log('Stored event:', eventData.id);

  if (ignoreNewEvent) {
    await logIntegration(supabase, 'warning', `Event stored but ignored (day change)`, {
      event_id: eventData.id,
      external_id: payload.externalId,
      dialer_id: dialerId,
      dialer_name: dialerName,
    });
    return {
      success: true,
      message: 'Event stored but ignored due to day change',
      event_id: eventData.id,
    };
  }

  // Delete previous sales for same-day correction
  if (isSameDayCorrection && existingSales.length > 0) {
    const saleIds = existingSales.map((s) => s.id);
    await supabase.from('sale_items').delete().in('sale_id', saleIds);
    await supabase.from('sales').delete().in('id', saleIds);
  }

  // Campaign mapping
  const { data: campaignMapping } = await supabase
    .from('adversus_campaign_mappings')
    .select('client_campaign_id')
    .eq('adversus_campaign_id', payload.campaignId)
    .maybeSingle();

  if (!campaignMapping && payload.campaignId) {
    await supabase.from('adversus_campaign_mappings').insert({
      adversus_campaign_id: payload.campaignId,
      adversus_campaign_name: payload.campaignName,
      client_campaign_id: null,
    });
  }

  // Create sale record with dialer source
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      adversus_event_id: eventData.id,
      client_campaign_id: campaignMapping?.client_campaign_id || null,
      agent_name: payload.agentName,
      agent_email: payload.agentEmail || null,
      agent_external_id: payload.agentId,
      customer_company: payload.customerCompany,
      customer_phone: payload.customerPhone,
      sale_datetime: payload.eventTime,
      adversus_external_id: payload.externalId,
      adversus_opp_number: payload.externalReference,
      validation_status: 'pending',
      source: dialerName,
      integration_type: provider,
    })
    .select()
    .single();

  if (saleError) throw saleError;
  console.log('Created sale:', saleData.id);

  // Process products
  const saleItems = [];
  for (const product of payload.products) {
    let mappedProductId: string | null = null;
    let commission = 0;
    let revenue = 0;
    let needsMapping = true;

    if (product.externalId) {
      const { data: productMapping } = await supabase
        .from('adversus_product_mappings')
        .select('product_id')
        .eq('adversus_external_id', product.externalId)
        .maybeSingle();

      if (productMapping?.product_id) {
        mappedProductId = productMapping.product_id;
        needsMapping = false;

        const { data: productDetails } = await supabase
          .from('products')
          .select('commission_dkk, revenue_dkk')
          .eq('id', mappedProductId)
          .single();

        if (productDetails) {
          commission = productDetails.commission_dkk || 0;
          revenue = productDetails.revenue_dkk || 0;
        }
      }
    }

    if (!mappedProductId) {
      const { data: productByTitle } = await supabase
        .from('products')
        .select('id, commission_dkk, revenue_dkk')
        .ilike('name', product.title)
        .maybeSingle();

      if (productByTitle) {
        mappedProductId = productByTitle.id;
        commission = productByTitle.commission_dkk || 0;
        revenue = productByTitle.revenue_dkk || 0;
        needsMapping = false;

        if (product.externalId) {
          await supabase.from('adversus_product_mappings').upsert({
            adversus_external_id: product.externalId,
            adversus_product_title: product.title,
            product_id: productByTitle.id,
          }, { onConflict: 'adversus_external_id' });
        }
      }
    }

    if (!mappedProductId && product.externalId) {
      await supabase.from('adversus_product_mappings').upsert({
        adversus_external_id: product.externalId,
        adversus_product_title: product.title,
        product_id: null,
      }, { onConflict: 'adversus_external_id' });
    }

    saleItems.push({
      sale_id: saleData.id,
      product_id: mappedProductId,
      adversus_external_id: product.externalId || null,
      adversus_product_title: product.title,
      quantity: product.quantity,
      unit_price: product.unitPrice,
      mapped_commission: commission * product.quantity,
      mapped_revenue: revenue * product.quantity,
      needs_mapping: needsMapping,
      raw_data: product,
    });
  }

  if (saleItems.length > 0) {
    await supabase.from('sale_items').insert(saleItems);
  }
  
  await supabase.from('adversus_events').update({ processed: true }).eq('id', eventData.id);

  const itemsNeedingMapping = saleItems.filter(i => i.needs_mapping).length;

  await logIntegration(supabase, 'success', `Webhook processed: Sale ${saleData.id}`, {
    event_id: eventData.id,
    sale_id: saleData.id,
    dialer_id: dialerId,
    dialer_name: dialerName,
    provider,
    agent_name: payload.agentName,
    campaign_name: payload.campaignName,
    items_created: saleItems.length,
    items_needing_mapping: itemsNeedingMapping,
  });

  return {
    success: true,
    event_id: eventData.id,
    sale_id: saleData.id,
    dialer_id: dialerId,
    dialer_name: dialerName,
    items_created: saleItems.length,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Extract dialer_id from URL query params
  const url = new URL(req.url);
  const dialerId = url.searchParams.get('dialer_id');
  const authKey = url.searchParams.get('authKey');

  console.log('=== DIALER WEBHOOK REQUEST ===');
  console.log('URL:', req.url);
  console.log('dialer_id:', dialerId);
  console.log('authKey:', authKey ? '***' : '(none)');
  console.log('Method:', req.method);

  // Log all headers for debugging
  console.log('=== HEADERS ===');
  const headerEntries: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headerEntries[key] = value;
    console.log(`  ${key}: ${value}`);
  });

  // Fetch dialer integration info to know provider type
  let dialerInfo: { id: string; name: string; provider: string } | null = null;
  if (dialerId) {
    const { data } = await supabase
      .from('dialer_integrations')
      .select('id, name, provider')
      .eq('id', dialerId)
      .maybeSingle();
    dialerInfo = data;
    console.log('Dialer info:', dialerInfo ? `${dialerInfo.name} (${dialerInfo.provider})` : 'Not found');
  }

  try {
    // Read body - try multiple methods for robustness
    let rawBody = '';
    const contentType = req.headers.get('content-type') || '';
    const contentLength = req.headers.get('content-length');
    const transferEncoding = req.headers.get('transfer-encoding');
    
    console.log('Content-Type:', contentType);
    console.log('Content-Length:', contentLength);
    console.log('Transfer-Encoding:', transferEncoding);
    
    // Clone request to read body safely
    const clonedReq = req.clone();
    
    try {
      // Try reading as text first
      rawBody = await clonedReq.text();
    } catch (textError) {
      console.log('Failed to read as text, trying arrayBuffer:', textError);
      // Fallback to arrayBuffer
      try {
        const buffer = await req.arrayBuffer();
        rawBody = new TextDecoder().decode(buffer);
      } catch (bufferError) {
        console.log('Failed to read as arrayBuffer:', bufferError);
      }
    }
    
    console.log('=== RAW BODY ===');
    console.log('Raw body length:', rawBody.length);
    console.log('Raw body (full):', rawBody);
    console.log('Raw body hex (first 100):', Array.from(rawBody.slice(0, 100)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' '));
    
    // Check if data might be in query params (some webhooks do this)
    console.log('=== QUERY PARAMS ===');
    url.searchParams.forEach((value, key) => {
      if (key !== 'dialer_id' && key !== 'authKey') {
        console.log(`  ${key}: ${value.substring(0, 200)}`);
      }
    });
    console.log('================================');

    // Handle empty body (health checks, verification)
    if (!rawBody || rawBody.trim() === '') {
      console.log('Empty body received - returning 200 OK');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook endpoint active', 
          dialer_id: dialerId,
          headers_received: headerEntries,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use factory to parse webhook based on provider or auto-detect
    const providerHint = dialerInfo?.provider;
    const parseResult = parseWebhook(rawBody, contentType, req.headers, providerHint);
    
    if (!parseResult) {
      console.error('Could not parse webhook payload');
      
      // Store raw event anyway for debugging
      try {
        await supabase.from('adversus_events').insert({
          external_id: `unparsed-${Date.now()}`,
          event_type: 'unparsed_webhook',
          payload: {
            raw_body: rawBody,
            content_type: contentType,
            headers: headerEntries,
            dialer_id: dialerId,
            dialer_name: dialerInfo?.name,
            provider: dialerInfo?.provider,
            received_at: new Date().toISOString(),
          },
          processed: false,
          received_at: new Date().toISOString(),
        });
        console.log('Stored unparsed event for debugging');
      } catch (storeErr) {
        console.error('Failed to store unparsed event:', storeErr);
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not parse webhook payload',
          body_received: rawBody,
          body_length: rawBody.length,
          content_type: contentType,
          headers: headerEntries,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsed webhook (${parseResult.provider}):`, JSON.stringify(parseResult.payload, null, 2).substring(0, 2000));

    // Process the normalized payload
    const result = await processWebhookPayload(
      supabase,
      parseResult.payload,
      parseResult.provider,
      dialerInfo
    );

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
