import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MonthlySummary {
  month: string;
  revenue_actual: number;
  expenses_variable_actual: number;
  expenses_fixed_planned: number;
  salary: number;
  profit: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const from = url.searchParams.get('from') || '2024-01';
    const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 7);
    const salaryParam = url.searchParams.get('salary') || '0';
    const monthlySalary = parseFloat(salaryParam);

    const fromDate = `${from}-01`;
    const toDate = `${to}-31`;

    console.log(`Fetching finance summary from ${fromDate} to ${toDate}`);

    // Fetch transactions in period
    const { data: txs, error: txError } = await supabase
      .from('transactions')
      .select('date, amount, type, category')
      .gte('date', fromDate)
      .lte('date', toDate);

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw txError;
    }

    // Fetch active fixed costs
    const { data: fixedCosts, error: fcError } = await supabase
      .from('fixed_costs')
      .select('category, amount, frequency, start_date, end_date, active')
      .eq('active', true);

    if (fcError) {
      console.error('Error fetching fixed costs:', fcError);
      throw fcError;
    }

    const monthKey = (d: string) => d.slice(0, 7);
    const summary: Record<string, MonthlySummary> = {};

    // Initialize months and aggregate transactions
    for (const tx of txs || []) {
      const m = monthKey(tx.date);
      if (!summary[m]) {
        summary[m] = {
          month: m,
          revenue_actual: 0,
          expenses_variable_actual: 0,
          expenses_fixed_planned: 0,
          salary: monthlySalary,
          profit: 0,
        };
      }
      if (tx.type === 'revenue') {
        summary[m].revenue_actual += Number(tx.amount);
      }
      if (tx.type === 'expense') {
        summary[m].expenses_variable_actual += Number(tx.amount);
      }
    }

    // Fold fixed costs into months
    for (const fc of fixedCosts || []) {
      if (!fc.active) continue;

      const start = new Date(fc.start_date);
      const end = fc.end_date ? new Date(fc.end_date) : new Date(toDate);
      const fromDateObj = new Date(fromDate);
      const toDateObj = new Date(toDate);

      // Iterate through months
      const current = new Date(Math.max(start.getTime(), fromDateObj.getTime()));
      current.setDate(1);

      while (current <= end && current <= toDateObj) {
        const m = current.toISOString().slice(0, 7);
        
        if (!summary[m]) {
          summary[m] = {
            month: m,
            revenue_actual: 0,
            expenses_variable_actual: 0,
            expenses_fixed_planned: 0,
            salary: monthlySalary,
            profit: 0,
          };
        }

        const monthlyAmount = fc.frequency === 'monthly' 
          ? Number(fc.amount) 
          : Number(fc.amount) / 12;

        summary[m].expenses_fixed_planned += monthlyAmount;
        current.setMonth(current.getMonth() + 1);
      }
    }

    // Calculate profit for each month
    for (const m in summary) {
      const s = summary[m];
      s.profit = s.revenue_actual - s.expenses_variable_actual - s.expenses_fixed_planned - s.salary;
    }

    // Get top expenses by category for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthStart = `${currentMonth}-01`;
    const currentMonthEnd = `${currentMonth}-31`;

    const { data: expensesByCategory } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('type', 'expense')
      .gte('date', currentMonthStart)
      .lte('date', currentMonthEnd);

    const categoryTotals: Record<string, number> = {};
    for (const exp of expensesByCategory || []) {
      const cat = exp.category || 'Ukendt';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(exp.amount);
    }

    const expensesByCategoryList = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    // Get top 10 expenses
    const { data: topExpenses } = await supabase
      .from('transactions')
      .select('date, amount, text, category')
      .eq('type', 'expense')
      .gte('date', currentMonthStart)
      .lte('date', currentMonthEnd)
      .order('amount', { ascending: false })
      .limit(10);

    const monthlySummaryList = Object.values(summary).sort((a, b) => 
      a.month.localeCompare(b.month)
    );

    return new Response(JSON.stringify({
      monthly_summary: monthlySummaryList,
      current_month: summary[currentMonth] || null,
      expenses_by_category: expensesByCategoryList,
      top_expenses: topExpenses || [],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in finance-summary:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
