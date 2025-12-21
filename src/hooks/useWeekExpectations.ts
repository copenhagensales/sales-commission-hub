import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WeekExpectation {
  id: string;
  week_number: number;
  title: string;
  color: string;
  measure_on: string[];
  do_not_measure_on: string[];
  good_day_definition: string;
  note: string | null;
  we_expect: string[];
  we_dont_expect: string[];
  good_week_criteria: string[];
  daily_message: string;
  progression_text: string;
  created_at: string;
  updated_at: string;
}

export function useWeekExpectations() {
  return useQuery({
    queryKey: ["week-expectations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_week_expectations")
        .select("*")
        .order("week_number");
      
      if (error) throw error;
      return data as WeekExpectation[];
    },
  });
}

export function useUpdateWeekExpectation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WeekExpectation> }) => {
      const { error } = await supabase
        .from("onboarding_week_expectations")
        .update(updates)
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["week-expectations"] });
    },
  });
}
