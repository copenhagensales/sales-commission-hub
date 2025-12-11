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

    // Store raw event
    await supabase
      .from('economic_events')
      .insert({
        event_type: payload.eventType || payload.type || 'unknown',
        payload: payload,
        processed: false
      });

    // Get accounts map for categorization
    const { data: accountsMap } = await supabase
      .from('accounts_map')
      .select('*');

    const accountLookup = new Map(
      (accountsMap || []).map((a: any) => [a.account_number, { category: a.category, type: a.type }])
    );

    let inserted = 0;

    // Process webhook data directly into transactions
    // Handle different e-conomic event types
    if (payload.data) {
      const data = payload.data;
      
      // Handle invoice events
      if (data.invoiceNumber || data.invoice) {
        const invoice = data.invoice || data;
        const accountNumber = invoice.accountNumber?.toString() || '';
        const mapping = accountLookup.get(accountNumber) || { category: 'Ukendt', type: 'revenue' };
        
        const transaction = {
          date: invoice.date || new Date().toISOString().split('T')[0],
          amount: Math.abs(invoice.netAmount || invoice.amount || 0),
          account_number: accountNumber,
          text: invoice.text || invoice.description || `Faktura ${invoice.invoiceNumber || data.invoiceNumber}`,
          voucher_id: (invoice.invoiceNumber || data.invoiceNumber)?.toString() || null,
          type: 'revenue',
          category: mapping.category,
          source_id: `economic-invoice-${invoice.invoiceNumber || data.invoiceNumber}`,
        };

        const { error } = await supabase
          .from('transactions')
          .upsert(transaction, { onConflict: 'source_id' });

        if (!error) inserted++;
        else console.error('Error inserting invoice transaction:', error);
      }

      // Handle journal entry events
      if (data.entries || data.journalEntry) {
        const entries = data.entries || [data.journalEntry];
        
        for (const entry of entries) {
          const accountNumber = entry.account?.accountNumber?.toString() || entry.accountNumber?.toString() || '';
          const mapping = accountLookup.get(accountNumber) || { 
            category: 'Ukendt', 
            type: (entry.amount || 0) < 0 ? 'expense' : 'revenue' 
          };

          const transaction = {
            date: entry.date || new Date().toISOString().split('T')[0],
            amount: Math.abs(entry.amount || 0),
            account_number: accountNumber,
            text: entry.text || entry.description || '',
            voucher_id: entry.voucherNumber?.toString() || entry.entryNumber?.toString() || null,
            type: (entry.amount || 0) < 0 ? 'expense' : 'revenue',
            category: mapping.category,
            source_id: `economic-entry-${entry.entryNumber || entry.journalEntryNumber || Date.now()}`,
          };

          const { error } = await supabase
            .from('transactions')
            .upsert(transaction, { onConflict: 'source_id' });

          if (!error) inserted++;
          else console.error('Error inserting journal entry:', error);
        }
      }

      // Handle supplier invoice / expense events
      if (data.supplierInvoice || data.expense) {
        const expense = data.supplierInvoice || data.expense;
        const accountNumber = expense.accountNumber?.toString() || '';
        const mapping = accountLookup.get(accountNumber) || { category: 'Ukendt', type: 'expense' };

        const transaction = {
          date: expense.date || expense.invoiceDate || new Date().toISOString().split('T')[0],
          amount: Math.abs(expense.netAmount || expense.amount || 0),
          account_number: accountNumber,
          text: expense.text || expense.description || expense.supplierName || '',
          voucher_id: expense.invoiceNumber?.toString() || null,
          type: 'expense',
          category: mapping.category,
          source_id: `economic-expense-${expense.invoiceNumber || Date.now()}`,
        };

        const { error } = await supabase
          .from('transactions')
          .upsert(transaction, { onConflict: 'source_id' });

        if (!error) inserted++;
        else console.error('Error inserting expense:', error);
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

    return new Response(JSON.stringify({ success: true, inserted }), {
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
