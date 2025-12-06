import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPP_FIELD_ID = 80862;
const BATCH_SIZE = 10; // Process 10 sales per run to avoid timeout
const DELAY_MS = 3000; // 3 seconds between API calls

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    const authHeader = btoa(`${adversusUsername}:${adversusPassword}`);
    const baseUrl = 'https://api.adversus.io/v1';

    // Find TDC sales without OPP number
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        id, 
        adversus_external_id, 
        adversus_event_id,
        client_campaigns!inner(
          id,
          clients!inner(name)
        )
      `)
      .is('adversus_opp_number', null)
      .not('adversus_event_id', 'is', null)
      .limit(BATCH_SIZE);

    if (salesError) throw salesError;

    // Filter for TDC sales only
    const tdcSales = (sales || []).filter((sale: any) => 
      sale.client_campaigns?.clients?.name?.toLowerCase().includes('tdc')
    );

    if (tdcSales.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No TDC sales without OPP number found',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${tdcSales.length} TDC sales without OPP...`);

    const results: { saleId: string; oppNumber: string | null; error?: string }[] = [];

    for (const sale of tdcSales) {
      try {
        // Get lead ID from the adversus event
        const { data: event } = await supabase
          .from('adversus_events')
          .select('payload')
          .eq('id', sale.adversus_event_id)
          .maybeSingle();

        if (!event) {
          results.push({ saleId: sale.id, oppNumber: null, error: 'Event not found' });
          continue;
        }

        const leadId = (event.payload as any)?.payload?.lead?.id;
        if (!leadId) {
          results.push({ saleId: sale.id, oppNumber: null, error: 'No lead ID in event' });
          continue;
        }

        console.log(`Fetching lead ${leadId} for sale ${sale.adversus_external_id}...`);

        // Wait before API call to avoid rate limiting
        await sleep(DELAY_MS);

        const leadResponse = await fetch(`${baseUrl}/leads/${leadId}`, {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/json'
          }
        });

        if (!leadResponse.ok) {
          const status = leadResponse.status;
          console.error(`Failed to fetch lead ${leadId}: ${status}`);
          results.push({ saleId: sale.id, oppNumber: null, error: `API error: ${status}` });
          
          if (status === 429) {
            console.log('Rate limited, stopping batch');
            break;
          }
          continue;
        }

        const leadData = await leadResponse.json();
        const lead = Array.isArray(leadData) ? leadData[0] : (leadData.leads ? leadData.leads[0] : leadData);

        if (!lead) {
          results.push({ saleId: sale.id, oppNumber: null, error: 'Lead not found in Adversus' });
          continue;
        }

        // Extract OPP number
        let oppNumber: string | null = null;
        const resultData = Array.isArray(lead.resultData) ? lead.resultData : [];

        if (resultData.length > 0) {
          const byId = resultData.find(
            (rd: { id?: number; value?: string }) => 
              rd && rd.id === OPP_FIELD_ID && typeof rd.value === 'string' && rd.value.trim()
          );

          if (byId) {
            oppNumber = (byId.value as string).trim();
          } else {
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
            }
          }
        }

        if (oppNumber) {
          const { error: updateError } = await supabase
            .from('sales')
            .update({ adversus_opp_number: oppNumber })
            .eq('id', sale.id);

          if (updateError) {
            results.push({ saleId: sale.id, oppNumber: null, error: updateError.message });
          } else {
            console.log(`Updated sale ${sale.adversus_external_id} with OPP: ${oppNumber}`);
            results.push({ saleId: sale.id, oppNumber });
          }
        } else {
          // Mark as checked by setting empty string to avoid re-processing
          await supabase
            .from('sales')
            .update({ adversus_opp_number: '' })
            .eq('id', sale.id);
          results.push({ saleId: sale.id, oppNumber: null, error: 'No OPP in Adversus' });
        }

      } catch (err) {
        console.error(`Error processing sale ${sale.id}:`, err);
        results.push({ saleId: sale.id, oppNumber: null, error: String(err) });
      }
    }

    // Count remaining TDC sales without OPP
    const { count: remaining } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true })
      .is('adversus_opp_number', null)
      .not('adversus_event_id', 'is', null);

    const successful = results.filter(r => r.oppNumber).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        successful,
        remaining: remaining || 0,
        results
      }),
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
