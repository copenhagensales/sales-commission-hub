import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload = await req.json();
    console.log('Received e-conomic webhook:', JSON.stringify(payload, null, 2));

    // Store raw event for processing
    const { error } = await supabase
      .from('economic_events')
      .insert({
        event_type: payload.eventType || payload.type || 'unknown',
        payload: payload,
        processed: false
      });

    if (error) {
      console.error('Error storing economic event:', error);
      throw error;
    }

    console.log('Successfully stored e-conomic webhook event');

    // Trigger sync in background
    try {
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/sync-economic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      
      if (syncResponse.ok) {
        console.log('Sync triggered successfully');
        
        // Mark event as processed
        await supabase
          .from('economic_events')
          .update({ processed: true })
          .eq('payload', payload);
      } else {
        console.error('Sync trigger failed:', await syncResponse.text());
      }
    } catch (syncError) {
      console.error('Error triggering sync:', syncError);
      // Don't fail the webhook just because sync failed
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (error: unknown) {
    console.error('Error processing e-conomic webhook:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
