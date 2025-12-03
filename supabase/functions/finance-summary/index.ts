import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || new Date().toISOString().slice(0, 7);
    const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 7);
    const salaryPerMonth = parseFloat(url.searchParams.get('salary') || '0');

    const fromDate = `${from}-01`;
    const toDate = `${to}-31`;

    console.log(`Fetching summary from ${fromDate} to ${toDate}`);

    // Fetch transactions
    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .select('date, amount, type, category')
      .gte('date', fromDate)
      .lte('date', toDate);

    if (txError) throw txError;

    // Fetch active fixed costs
    const { data: fixed, error: fixedError } = await supabase
      .from('fixed_costs')
      .select('category, amount, frequency, start_date, end_date, active')
      .eq('active', true);

    if (fixedError) throw fixedError;

    const monthKey = (d: string) => d.slice(0, 7);

    const summary: Record<string, {
      month: string;
      revenue_actual: number;
      expenses_variable_actual: number;
      expenses_fixed_planned: number;
      salary: number;
      profit: number;
      categories: Record<string, number>;
    }> = {};

    // Process transactions
    for (const tx of txs || []) {
      const m = monthKey(tx.date);
      if (!summary[m]) {
        summary[m] = {
          month: m,
          revenue_actual: 0,
          expenses_variable_actual: 0,
          expenses_fixed_planned: 0,
          salary: salaryPerMonth,
          profit: 0,
          categories: {},
        };
      }
      
      if (tx.type === 'revenue') {
        summary[m].revenue_actual += Number(tx.amount);
      }
      if (tx.type === 'expense') {
        summary[m].expenses_variable_actual += Number(tx.amount);
        // Track by category
        const cat = tx.category || 'Uncategorized';
        summary[m].categories[cat] = (summary[m].categories[cat] || 0) + Number(tx.amount);
      }
    }

    // Process fixed costs
    for (const fc of fixed || []) {
      if (!fc.active) continue;

      const start = new Date(fc.start_date);
      const end = fc.end_date ? new Date(fc.end_date) : new Date(toDate);
      const fromD = new Date(fromDate);
      const toD = new Date(toDate);

      // Iterate through months
      const current = new Date(Math.max(start.getTime(), fromD.getTime()));
      current.setDate(1);

      while (current <= end && current <= toD) {
        const m = current.toISOString().slice(0, 7);
        
        if (!summary[m]) {
          summary[m] = {
            month: m,
            revenue_actual: 0,
            expenses_variable_actual: 0,
            expenses_fixed_planned: 0,
            salary: salaryPerMonth,
            profit: 0,
            categories: {},
          };
        }

        const amt = fc.frequency === 'monthly' ? Number(fc.amount) : Number(fc.amount) / 12;
        summary[m].expenses_fixed_planned += amt;

        current.setMonth(current.getMonth() + 1);
      }
    }

    // Calculate profit for each month
    for (const m in summary) {
      const s = summary[m];
      s.profit = s.revenue_actual - s.expenses_variable_actual - s.expenses_fixed_planned - s.salary;
    }

    // Get top expenses
    const allExpenses: Array<{ category: string; amount: number }> = [];
    for (const m in summary) {
      for (const [category, amount] of Object.entries(summary[m].categories)) {
        const existing = allExpenses.find(e => e.category === category);
        if (existing) {
          existing.amount += amount;
        } else {
          allExpenses.push({ category, amount });
        }
      }
    }
    allExpenses.sort((a, b) => b.amount - a.amount);

    return new Response(
      JSON.stringify({
        monthly_summary: Object.values(summary).sort((a, b) => a.month.localeCompare(b.month)),
        top_expenses: allExpenses.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Summary error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
