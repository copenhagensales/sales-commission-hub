import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthlySummary {
  month: string;
  revenue_actual: number;
  expenses_variable_actual: number;
  expenses_fixed_planned: number;
  salary: number;
  profit: number;
}

export interface ExpenseByCategory {
  category: string;
  amount: number;
}

export interface TopExpense {
  date: string;
  amount: number;
  text: string;
  category: string;
}

export interface FinanceSummaryData {
  monthly_summary: MonthlySummary[];
  current_month: MonthlySummary | null;
  expenses_by_category: ExpenseByCategory[];
  top_expenses: TopExpense[];
}

interface UseFinanceSummaryOptions {
  from?: string;
  to?: string;
  salary?: number;
}

export function useFinanceSummary(options: UseFinanceSummaryOptions = {}) {
  const { 
    from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
    to = new Date().toISOString().slice(0, 7),
    salary = 0 
  } = options;

  return useQuery({
    queryKey: ['finance-summary', from, to, salary],
    queryFn: async () => {
      // Get session for auth header
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/finance-summary?from=${from}&to=${to}&salary=${salary}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token || anonKey}`,
            'apikey': anonKey,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to fetch finance summary');
      }

      return response.json() as Promise<FinanceSummaryData>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSyncEconomic() {
  return useQuery({
    queryKey: ['sync-economic'],
    queryFn: async () => {
      const response = await fetch(
        'https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/sync-economic',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to sync with e-conomic');
      }

      return response.json();
    },
    enabled: false, // Only run manually
  });
}
