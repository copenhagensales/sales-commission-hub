import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MonthlySummary {
  month: string;
  revenue_actual: number;
  expenses_variable_actual: number;
  expenses_fixed_planned: number;
  salary: number;
  profit: number;
  categories: Record<string, number>;
}

interface TopExpense {
  category: string;
  amount: number;
}

interface FinanceSummary {
  monthly_summary: MonthlySummary[];
  top_expenses: TopExpense[];
}

export function useFinanceSummary(from: string, to: string, salaryPerMonth: number) {
  const [data, setData] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke('finance-summary', {
        body: null,
        method: 'GET',
      });

      // Since we can't pass query params easily, let's fetch directly
      const response = await fetch(
        `https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/finance-summary?from=${from}&to=${to}&salary=${salaryPerMonth}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const json = await response.json();
      setData(json);
    } catch (err) {
      console.error('Error fetching finance summary:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [from, to, salaryPerMonth]);

  return { data, loading, error, refetch: fetchSummary };
}
