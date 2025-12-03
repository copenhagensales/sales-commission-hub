import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EconomicEntry {
  entryNumber: number;
  date: string;
  amount: number;
  account: {
    accountNumber: number;
  };
  text?: string;
  voucherNumber?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const appSecretToken = Deno.env.get('ECONOMIC_APP_SECRET_TOKEN');
  const agreementGrantToken = Deno.env.get('ECONOMIC_AGREEMENT_GRANT_TOKEN');

  if (!appSecretToken || !agreementGrantToken) {
    console.error('Missing e-conomic credentials');
    return new Response(
      JSON.stringify({ error: 'Missing e-conomic credentials' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get last sync state
    const { data: syncState } = await supabase
      .from('sync_state')
      .select('*')
      .eq('id', 1)
      .single();

    const lastEntryDate = syncState?.last_entry_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`Syncing entries from: ${lastEntryDate}`);

    // Fetch entries from e-conomic
    const response = await fetch(
      `https://restapi.e-conomic.com/journals-experimental/entries?filter=date$gte:${lastEntryDate}`,
      {
        headers: {
          'X-AppSecretToken': appSecretToken,
          'X-AgreementGrantToken': agreementGrantToken,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('e-conomic API error:', errorText);
      throw new Error(`e-conomic API error: ${response.status}`);
    }

    const data = await response.json();
    const entries: EconomicEntry[] = data.collection || [];
    
    console.log(`Fetched ${entries.length} entries from e-conomic`);

    // Get account mappings
    const { data: accountMappings } = await supabase
      .from('accounts_map')
      .select('*');

    const accountMap = new Map(
      (accountMappings || []).map(m => [m.account_number, { category: m.category, type: m.type }])
    );

    let inserted = 0;
    let skipped = 0;
    let latestDate = lastEntryDate;

    for (const entry of entries) {
      const accountNumber = String(entry.account?.accountNumber || '');
      const mapping = accountMap.get(accountNumber);
      
      // Determine type based on amount if no mapping
      let entryType = mapping?.type;
      if (!entryType) {
        entryType = entry.amount >= 0 ? 'revenue' : 'expense';
      }

      const sourceId = `economic-${entry.entryNumber}`;

      // Upsert transaction
      const { error } = await supabase
        .from('transactions')
        .upsert({
          date: entry.date,
          amount: Math.abs(entry.amount),
          account_number: accountNumber,
          text: entry.text || null,
          voucher_id: entry.voucherNumber ? String(entry.voucherNumber) : null,
          type: entryType,
          category: mapping?.category || 'Uncategorized',
          source_id: sourceId,
        }, {
          onConflict: 'source_id',
        });

      if (error) {
        console.error('Insert error:', error);
        skipped++;
      } else {
        inserted++;
        if (entry.date > latestDate) {
          latestDate = entry.date;
        }
      }
    }

    // Update sync state
    await supabase
      .from('sync_state')
      .upsert({
        id: 1,
        last_sync_at: new Date().toISOString(),
        last_entry_date: latestDate,
      });

    console.log(`Sync complete: ${inserted} inserted, ${skipped} skipped`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted, 
        skipped, 
        total: entries.length,
        lastEntryDate: latestDate 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
