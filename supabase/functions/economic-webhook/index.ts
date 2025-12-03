import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const body = await req.json();
    console.log('Received e-conomic webhook:', JSON.stringify(body, null, 2));

    // e-conomic webhook payload structure
    const { eventType, data } = body;

    // Log the webhook event
    console.log(`Event type: ${eventType}`);

    // Trigger sync when invoice or journal is posted
    if (eventType === 'invoice.booked' || eventType === 'journalEntry.booked') {
      console.log('Triggering entries sync...');
      
      // Call the sync function
      const syncResponse = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-economic`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ trigger: eventType }),
        }
      );

      const syncResult = await syncResponse.json();
      console.log('Sync result:', syncResult);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook received' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
