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
    const appSecretToken = Deno.env.get('ECONOMIC_APP_SECRET_TOKEN')!;
    const agreementGrantToken = Deno.env.get('ECONOMIC_AGREEMENT_GRANT_TOKEN')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting e-conomic sync...');

    // Parse request body for custom date range
    let fromDate: string;
    try {
      const body = await req.json();
      if (body.fromDate) {
        fromDate = body.fromDate;
      } else if (body.days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - body.days);
        fromDate = daysAgo.toISOString().split('T')[0];
      } else {
        // Default to last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        fromDate = thirtyDaysAgo.toISOString().split('T')[0];
      }
    } catch {
      // Default to last 30 days if no body
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    }
    
    console.log('Fetching data from date:', fromDate);

    // Get accounts map for categorization
    const { data: accountsMap } = await supabase
      .from('accounts_map')
      .select('*');

    const accountLookup = new Map(
      (accountsMap || []).map(a => [a.account_number, { category: a.category, type: a.type }])
    );

    // Fetch entries from e-conomic
    const economicHeaders = {
      'X-AppSecretToken': appSecretToken,
      'X-AgreementGrantToken': agreementGrantToken,
      'Content-Type': 'application/json',
    };

    // Fetch journal entries (kassekladder)
    const entriesUrl = `https://restapi.e-conomic.com/journals-experimental/entries?filter=date$gte:${fromDate}&pagesize=1000`;
    console.log('Fetching entries from:', entriesUrl);

    const entriesResponse = await fetch(entriesUrl, { headers: economicHeaders });
    
    if (!entriesResponse.ok) {
      const errorText = await entriesResponse.text();
      console.error('e-conomic API error:', entriesResponse.status, errorText);
      throw new Error(`e-conomic API error: ${entriesResponse.status}`);
    }

    const entriesData = await entriesResponse.json();
    const entries = entriesData.collection || [];
    console.log(`Fetched ${entries.length} entries`);

    let inserted = 0;
    let skipped = 0;

    for (const entry of entries) {
      const accountNumber = entry.account?.accountNumber?.toString() || '';
      const mapping = accountLookup.get(accountNumber) || { category: 'Ukendt', type: entry.amount < 0 ? 'expense' : 'revenue' };
      
      const transaction = {
        date: entry.date,
        amount: Math.abs(entry.amount || 0),
        account_number: accountNumber,
        text: entry.text || '',
        voucher_id: entry.voucherNumber?.toString() || null,
        type: entry.amount < 0 ? 'expense' : 'revenue',
        category: mapping.category,
        source_id: `economic-${entry.entryNumber || entry.journalEntryNumber}`,
      };

      const { error } = await supabase
        .from('transactions')
        .upsert(transaction, { onConflict: 'source_id' });

      if (error) {
        console.error('Error inserting transaction:', error);
        skipped++;
      } else {
        inserted++;
      }
    }

    // Update sync state
    await supabase
      .from('sync_state')
      .upsert({
        id: 1,
        last_sync_at: new Date().toISOString(),
        last_entry_date: new Date().toISOString().split('T')[0],
      });

    console.log(`Sync complete. Inserted: ${inserted}, Skipped: ${skipped}`);

    return new Response(JSON.stringify({ 
      success: true, 
      inserted, 
      skipped,
      total: entries.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in sync-economic:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
