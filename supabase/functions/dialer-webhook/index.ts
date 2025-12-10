import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdversusProduct {
  id: number;
  externalId?: string;
  title: string;
  quantity: number;
  unitPrice: number;
}

interface AdversusPayload {
  type: string;
  event_time: string;
  payload: {
    result_id: number;
    campaign: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      name: string;
      email: string;
    };
    lead: {
      id: number;
      phone: string;
      company: string;
    };
    products: AdversusProduct[];
  };
}

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
      integration_type: 'webhook',
      integration_name: details.dialer_name || 'Dialer Webhook',
      status,
      message,
      details,
    });
  } catch (err) {
    console.error('Failed to log integration:', err);
  }
}

// Helper to resolve agent from agents table
// deno-lint-ignore no-explicit-any
async function resolveAgent(
  supabase: any,
  externalId: string,
  agentEmail: string
): Promise<string | null> {
  try {
    const { data: agentByExtId } = await supabase
      .from('agents')
      .select('id')
      .eq('external_adversus_id', externalId)
      .maybeSingle();

    if (agentByExtId?.id) return agentByExtId.id;

    const { data: agentByEmail } = await supabase
      .from('agents')
      .select('id')
      .eq('email', agentEmail)
      .maybeSingle();

    if (agentByEmail?.id) {
      await supabase
        .from('agents')
        .update({ external_adversus_id: externalId })
        .eq('id', agentByEmail.id);
      return agentByEmail.id;
    }

    return null;
  } catch (err) {
    console.error('Error resolving agent:', err);
    return null;
  }
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

  // Fetch dialer integration info
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
    const rawBody = await req.text();
    console.log('Content-Type:', req.headers.get('content-type'));
    console.log('Raw body length:', rawBody.length);
    console.log('Raw body:', rawBody.substring(0, 1000) || '(empty)');
    console.log('================================');

    // Handle empty body (health checks, verification)
    if (!rawBody || rawBody.trim() === '') {
      console.log('Empty body received - returning 200 OK');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook endpoint active', dialer_id: dialerId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse JSON
    let body: AdversusPayload;
    try {
      body = JSON.parse(rawBody);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      await logIntegration(supabase, 'error', 'Invalid JSON body received', {
        dialer_id: dialerId,
        dialer_name: dialerInfo?.name,
        body_preview: rawBody.substring(0, 500),
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Parsed webhook payload:', JSON.stringify(body, null, 2).substring(0, 2000));

    const externalId = String(body.payload.result_id);

    // Handle same-day corrections
    const newEventDate = body.event_time ? getDateOnly(body.event_time) : getDateOnly(new Date().toISOString());

    const { data: existingEvents } = await supabase
      .from('adversus_events')
      .select('id')
      .eq('external_id', externalId);

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
        external_id: externalId,
        event_type: body.type || 'result',
        payload: {
          ...body,
          _dialer_webhook_info: {
            dialer_id: dialerId,
            dialer_name: dialerInfo?.name,
            provider: dialerInfo?.provider,
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
        external_id: externalId,
        dialer_id: dialerId,
        dialer_name: dialerInfo?.name,
      });
      return new Response(
        JSON.stringify({ success: true, message: 'Event stored but ignored due to day change', event_id: eventData.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete previous sales for same-day correction
    if (isSameDayCorrection && existingSales.length > 0) {
      const saleIds = existingSales.map((s) => s.id);
      await supabase.from('sale_items').delete().in('sale_id', saleIds);
      await supabase.from('sales').delete().in('id', saleIds);
    }

    // Campaign mapping
    const adversusCampaignId = body.payload.campaign.id;
    const adversusCampaignName = body.payload.campaign.name;

    const { data: campaignMapping } = await supabase
      .from('adversus_campaign_mappings')
      .select('client_campaign_id')
      .eq('adversus_campaign_id', adversusCampaignId)
      .maybeSingle();

    if (!campaignMapping) {
      await supabase.from('adversus_campaign_mappings').insert({
        adversus_campaign_id: adversusCampaignId,
        adversus_campaign_name: adversusCampaignName,
        client_campaign_id: null,
      });
    }

    // Resolve agent
    const agentId = await resolveAgent(supabase, body.payload.user.id, body.payload.user.email);

    // Create sale record with dialer source
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        adversus_event_id: eventData.id,
        client_campaign_id: campaignMapping?.client_campaign_id || null,
        agent_id: agentId,
        agent_name: body.payload.user.name,
        agent_external_id: body.payload.user.id,
        customer_company: body.payload.lead.company,
        customer_phone: body.payload.lead.phone,
        sale_datetime: body.event_time || new Date().toISOString(),
        adversus_external_id: externalId,
        adversus_opp_number: null,
        validation_status: 'pending',
        source: dialerInfo?.name || 'Unknown Dialer',
        integration_type: dialerInfo?.provider || 'adversus',
      })
      .select()
      .single();

    if (saleError) throw saleError;
    console.log('Created sale:', saleData.id);

    // Process products
    const saleItems = [];
    for (const product of body.payload.products) {
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

    await supabase.from('sale_items').insert(saleItems);
    await supabase.from('adversus_events').update({ processed: true }).eq('id', eventData.id);

    const itemsNeedingMapping = saleItems.filter(i => i.needs_mapping).length;

    await logIntegration(supabase, 'success', `Webhook processed: Sale ${saleData.id}`, {
      event_id: eventData.id,
      sale_id: saleData.id,
      dialer_id: dialerId,
      dialer_name: dialerInfo?.name,
      provider: dialerInfo?.provider,
      agent_name: body.payload.user.name,
      campaign_name: adversusCampaignName,
      items_created: saleItems.length,
      items_needing_mapping: itemsNeedingMapping,
    });

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventData.id,
        sale_id: saleData.id,
        dialer_id: dialerId,
        dialer_name: dialerInfo?.name,
        items_created: saleItems.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await logIntegration(supabase, 'error', `Webhook failed: ${errorMessage}`, {
      error: errorMessage,
      dialer_id: dialerId,
      dialer_name: dialerInfo?.name,
    });

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
