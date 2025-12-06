import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPP_FIELD_ID = 80862;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adversusUsername = Deno.env.get('ADVERSUS_API_USERNAME');
    const adversusPassword = Deno.env.get('ADVERSUS_API_PASSWORD');
    
    if (!adversusUsername || !adversusPassword) {
      throw new Error('Adversus credentials not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { saleExternalId } = body;

    if (!saleExternalId) {
      throw new Error('saleExternalId is required');
    }

    console.log(`Fetching OPP for sale: ${saleExternalId}`);

    // Get the sale and its lead ID from adversus_events
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('id, adversus_external_id, adversus_opp_number, adversus_event_id')
      .eq('adversus_external_id', saleExternalId)
      .maybeSingle();

    if (saleError) throw saleError;
    if (!sale) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sale not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get lead ID from the adversus event
    const { data: event, error: eventError } = await supabase
      .from('adversus_events')
      .select('payload')
      .eq('id', sale.adversus_event_id)
      .maybeSingle();

    if (eventError) throw eventError;
    if (!event) {
      return new Response(
        JSON.stringify({ success: false, error: 'Event not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadId = (event.payload as any)?.payload?.lead?.id;
    if (!leadId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead ID not found in event' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching lead ${leadId} from Adversus API...`);

    // Fetch lead from Adversus API
    const authHeader = btoa(`${adversusUsername}:${adversusPassword}`);
    const baseUrl = 'https://api.adversus.io/v1';

    const leadResponse = await fetch(`${baseUrl}/leads/${leadId}`, {
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/json'
      }
    });

    if (!leadResponse.ok) {
      const status = leadResponse.status;
      console.error(`Failed to fetch lead: ${status}`);
      return new Response(
        JSON.stringify({ success: false, error: `Adversus API error: ${status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leadData = await leadResponse.json();
    const lead = Array.isArray(leadData) ? leadData[0] : (leadData.leads ? leadData.leads[0] : leadData);

    if (!lead) {
      return new Response(
        JSON.stringify({ success: false, error: 'Lead not found in Adversus' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract OPP number
    let oppNumber: string | null = null;
    const resultData = Array.isArray(lead.resultData) ? lead.resultData : [];

    if (resultData.length > 0) {
      // 1) Exact match on result field id 80862 ("OPP nr")
      const byId = resultData.find(
        (rd: { id?: number; value?: string }) => 
          rd && rd.id === OPP_FIELD_ID && typeof rd.value === 'string' && rd.value.trim()
      );

      if (byId) {
        oppNumber = (byId.value as string).trim();
        console.log(`Found OPP via field ID ${OPP_FIELD_ID}: ${oppNumber}`);
      } else {
        // 2) Fallback: match on label containing "opp"
        const byLabel = resultData.find(
          (rd: { label?: string; value?: string }) =>
            rd &&
            typeof rd.label === 'string' &&
            String(rd.label).toLowerCase().includes('opp') &&
            typeof rd.value === 'string' &&
            rd.value.trim()
        );

        if (byLabel) {
          oppNumber = (byLabel.value as string).trim();
          console.log(`Found OPP via label: ${oppNumber}`);
        }
      }
    }

    if (!oppNumber) {
      console.log('No OPP number found in lead data');
      return new Response(
        JSON.stringify({ success: true, oppNumber: null, message: 'No OPP number found in Adversus' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the sale with the OPP number
    const { error: updateError } = await supabase
      .from('sales')
      .update({ adversus_opp_number: oppNumber })
      .eq('id', sale.id);

    if (updateError) throw updateError;

    console.log(`Updated sale ${saleExternalId} with OPP: ${oppNumber}`);

    return new Response(
      JSON.stringify({ success: true, oppNumber, saleId: sale.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
