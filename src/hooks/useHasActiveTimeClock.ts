import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentEmployee } from "@/hooks/useShiftPlanning";

export function useHasActiveTimeClock() {
  const { data: employee } = useCurrentEmployee();

  return useQuery({
    queryKey: ["has-active-time-clock", employee?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_time_clocks")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", employee!.id)
        .eq("is_active", true);
      if (error) throw error;
      return (count ?? 0) > 0;
    },
    enabled: !!employee?.id,
  });
}
