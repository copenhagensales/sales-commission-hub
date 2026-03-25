import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ForecastOverride {
  id: string;
  employee_id: string;
  client_id: string;
  period_start: string;
  override_sales: number;
  note: string | null;
}

export function useEmployeeForecastOverrides(clientId: string, periodStart: string) {
  const queryClient = useQueryClient();
  const queryKey = ["employee-forecast-overrides", clientId, periodStart];

  const { data: overrides = new Map<string, ForecastOverride>(), isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clientId || clientId === "all" || !periodStart) return new Map<string, ForecastOverride>();

      const { data, error } = await supabase
        .from("employee_forecast_overrides")
        .select("*")
        .eq("client_id", clientId)
        .eq("period_start", periodStart);

      if (error) throw error;

      const map = new Map<string, ForecastOverride>();
      (data || []).forEach((row: any) => {
        map.set(row.employee_id, row as ForecastOverride);
      });
      return map;
    },
    enabled: !!clientId && clientId !== "all" && !!periodStart,
  });

  const upsertOverride = useMutation({
    mutationFn: async ({ employeeId, overrideSales, note }: { employeeId: string; overrideSales: number; note?: string }) => {
      const { error } = await supabase
        .from("employee_forecast_overrides")
        .upsert({
          employee_id: employeeId,
          client_id: clientId,
          period_start: periodStart,
          override_sales: overrideSales,
          note: note || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "employee_id,client_id,period_start" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Forecast override gemt");
    },
    onError: () => toast.error("Kunne ikke gemme override"),
  });

  const deleteOverride = useMutation({
    mutationFn: async (employeeId: string) => {
      const { error } = await supabase
        .from("employee_forecast_overrides")
        .delete()
        .eq("employee_id", employeeId)
        .eq("client_id", clientId)
        .eq("period_start", periodStart);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Override fjernet");
    },
    onError: () => toast.error("Kunne ikke fjerne override"),
  });

  return { overrides, isLoading, upsertOverride, deleteOverride };
}
