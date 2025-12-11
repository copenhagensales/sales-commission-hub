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

    const contentType = req.headers.get('content-type') || '';
    let payload: Record<string, any> = {};

    // Handle different content types from e-conomic
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await req.text();
      console.log('Received form-urlencoded data:', text);
      
      const params = new URLSearchParams(text);
      for (const [key, value] of params.entries()) {
        payload[key] = value;
      }
    } else if (contentType.includes('application/json')) {
      payload = await req.json();
      console.log('Received JSON data:', JSON.stringify(payload, null, 2));
    } else {
      // Try to read as text and parse
      const text = await req.text();
      console.log('Received raw data:', text);
      
      try {
        payload = JSON.parse(text);
      } catch {
        // Try form-urlencoded
        const params = new URLSearchParams(text);
        for (const [key, value] of params.entries()) {
          payload[key] = value;
        }
      }
    }

    console.log('Parsed payload:', JSON.stringify(payload, null, 2));

    // Determine event type from payload
    const eventType = payload.eventType || payload.type || payload.event || 'invoice_booked';

    // Store raw event
    const { error: eventError } = await supabase
      .from('economic_events')
      .insert({
        event_type: eventType,
        payload: payload,
        processed: false
      });

    if (eventError) {
      console.error('Error storing event:', eventError);
    } else {
      console.log('Event stored successfully');
    }

    // Get accounts map for categorization
    const { data: accountsMap } = await supabase
      .from('accounts_map')
      .select('*');

    const accountLookup = new Map(
      (accountsMap || []).map((a: any) => [a.account_number, { category: a.category, type: a.type }])
    );

    let inserted = 0;

    // Extract invoice data from e-conomic webhook
    // e-conomic sends data like: INVOICENO=12345, amount, date, etc.
    const invoiceNumber = payload.INVOICENO || payload.invoiceNumber || payload.invoice_number;
    const amount = parseFloat(payload.amount || payload.netAmount || payload.grossAmount || '0');
    const date = payload.date || payload.invoiceDate || new Date().toISOString().split('T')[0];
    const accountNumber = payload.accountNumber || payload.account || '';
    const text = payload.text || payload.description || `Faktura ${invoiceNumber}`;

    if (invoiceNumber) {
      const mapping = accountLookup.get(accountNumber) || { category: 'Faktura', type: 'revenue' };

      const transaction = {
        date: date,
        amount: Math.abs(amount),
        account_number: accountNumber,
        text: text,
        voucher_id: invoiceNumber.toString(),
        type: mapping.type || 'revenue',
        category: mapping.category || 'Faktura',
        source_id: `economic-invoice-${invoiceNumber}`,
      };

      console.log('Inserting transaction:', transaction);

      const { error } = await supabase
        .from('transactions')
        .upsert(transaction, { onConflict: 'source_id' });

      if (!error) {
        inserted++;
        console.log('Transaction inserted successfully');
      } else {
        console.error('Error inserting transaction:', error);
      }
    }

    // Mark event as processed
    if (inserted > 0) {
      await supabase
        .from('economic_events')
        .update({ processed: true })
        .eq('payload', payload);
    }

    console.log(`Webhook processed. Inserted/updated ${inserted} transactions`);

    return new Response(JSON.stringify({ success: true, inserted, eventType }), {
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
