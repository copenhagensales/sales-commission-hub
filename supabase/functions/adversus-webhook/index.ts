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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AdversusPayload = await req.json();
    console.log('Received webhook:', JSON.stringify(body, null, 2));

    const externalId = String(body.payload.result_id);

    // 1. Find existing events & sales for this result to handle corrections
    const newEventDate = body.event_time
      ? getDateOnly(body.event_time)
      : getDateOnly(new Date().toISOString());

    const { data: existingEvents, error: existingEventsError } = await supabase
      .from('adversus_events')
      .select('id')
      .eq('external_id', externalId);

    if (existingEventsError) {
      console.error('Error fetching existing events:', existingEventsError);
      throw existingEventsError;
    }

    let existingSales: { id: string; sale_datetime: string; adversus_event_id: string }[] = [];

    if (existingEvents && existingEvents.length > 0) {
      const existingEventIds = existingEvents.map((e: { id: string }) => e.id);

      const { data: salesForResult, error: salesError } = await supabase
        .from('sales')
        .select('id, sale_datetime, adversus_event_id')
        .in('adversus_event_id', existingEventIds);

      if (salesError) {
        console.error('Error fetching existing sales:', salesError);
        throw salesError;
      }

      existingSales = salesForResult || [];
    }

    let isSameDayCorrection = false;
    let ignoreNewEvent = false;

    if (existingSales.length > 0) {
      // Find original sale date for this result
      const sortedSales = [...existingSales].sort(
        (a, b) => new Date(a.sale_datetime).getTime() - new Date(b.sale_datetime).getTime(),
      );
      const originalSaleDate = getDateOnly(sortedSales[0].sale_datetime);

      if (newEventDate.getTime() === originalSaleDate.getTime()) {
        // Correction on same calendar day -> use latest event, delete previous sales
        isSameDayCorrection = true;
      } else {
        // Correction after day change -> keep original data, ignore this event for metrics
        ignoreNewEvent = true;
      }
    }

    // 2. Store raw event (always)
    const { data: eventData, error: eventError } = await supabase
      .from('adversus_events')
      .insert({
        external_id: externalId,
        event_type: body.type || 'result',
        payload: body,
        processed: false,
        received_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error storing event:', eventError);
      throw eventError;
    }

    console.log('Stored event:', eventData.id);

    if (ignoreNewEvent) {
      console.log('Ignoring new event due to day change for external_id:', externalId);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Event stored but ignored for metrics due to day change',
          event_id: eventData.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // If this is a same-day correction, delete previous sales & sale items for this result
    if (isSameDayCorrection && existingSales.length > 0) {
      const saleIds = existingSales.map((s) => s.id);
      console.log('Deleting previous sales for same-day correction, sale_ids:', saleIds);

      const { error: deleteItemsError } = await supabase
        .from('sale_items')
        .delete()
        .in('sale_id', saleIds);

      if (deleteItemsError) {
        console.error('Error deleting existing sale items:', deleteItemsError);
        throw deleteItemsError;
      }

      const { error: deleteSalesError } = await supabase
        .from('sales')
        .delete()
        .in('id', saleIds);

      if (deleteSalesError) {
        console.error('Error deleting existing sales:', deleteSalesError);
        throw deleteSalesError;
      }
    }

    // 3. Find or create campaign mapping
    const adversusCampaignId = body.payload.campaign.id;
    const adversusCampaignName = body.payload.campaign.name;

    const { data: campaignMapping } = await supabase
      .from('adversus_campaign_mappings')
      .select('client_campaign_id')
      .eq('adversus_campaign_id', adversusCampaignId)
      .maybeSingle();

    if (!campaignMapping) {
      // Create unmapped campaign entry
      await supabase
        .from('adversus_campaign_mappings')
        .insert({
          adversus_campaign_id: adversusCampaignId,
          adversus_campaign_name: adversusCampaignName,
          client_campaign_id: null,
        });
      console.log('Created unmapped campaign mapping for:', adversusCampaignName);
    }

    // 4. Create sale record
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        adversus_event_id: eventData.id,
        client_campaign_id: campaignMapping?.client_campaign_id || null,
        agent_name: body.payload.user.name,
        agent_external_id: body.payload.user.id,
        customer_company: body.payload.lead.company,
        customer_phone: body.payload.lead.phone,
        sale_datetime: body.event_time || new Date().toISOString(),
        adversus_external_id: externalId,
      })
      .select()
      .single();

    if (saleError) {
      console.error('Error creating sale:', saleError);
      throw saleError;
    }

    console.log('Created sale:', saleData.id);

    // 5. Process each product in the sale
    const saleItems = [];
    for (const product of body.payload.products) {
      // Try to find product mapping by externalId first
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

          // Get product details
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

      // If no mapping found, try to match by title in products table
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

          // Create the mapping for future use
          if (product.externalId) {
            await supabase
              .from('adversus_product_mappings')
              .upsert({
                adversus_external_id: product.externalId,
                adversus_product_title: product.title,
                product_id: productByTitle.id,
              }, { onConflict: 'adversus_external_id' });
          }
        }
      }

      // If still no mapping, create an unmapped entry
      if (!mappedProductId && product.externalId) {
        await supabase
          .from('adversus_product_mappings')
          .upsert({
            adversus_external_id: product.externalId,
            adversus_product_title: product.title,
            product_id: null,
          }, { onConflict: 'adversus_external_id' })
          .select();
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

    // 6. Insert all sale items
    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      console.error('Error creating sale items:', itemsError);
      throw itemsError;
    }

    // 7. Mark event as processed
    await supabase
      .from('adversus_events')
      .update({ processed: true })
      .eq('id', eventData.id);

    console.log('Webhook processed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        event_id: eventData.id,
        sale_id: saleData.id,
        items_created: saleItems.length,
        items_needing_mapping: saleItems.filter(i => i.needs_mapping).length,
      }),
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
