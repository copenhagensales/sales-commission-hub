import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RampBandPoint {
  day_no: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface RampMyPoint {
  day_no: number;
  cum_sales: number;
}

export interface RampData {
  employee_id: string;
  client_campaign_id: string;
  campaign_name: string | null;
  start_date: string;
  curve_version: number;
  current_day_no: number;
  er_aktiv: boolean;
  n_sellers: number | null;
  my_days: RampMyPoint[];
  band: RampBandPoint[];
}

function parseRamp(raw: unknown): RampData | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<RampData>;
  if (!value.client_campaign_id || !Array.isArray(value.band) || value.band.length === 0) {
    return null;
  }
  return {
    employee_id: String(value.employee_id ?? ""),
    client_campaign_id: value.client_campaign_id,
    campaign_name: value.campaign_name ?? null,
    start_date: String(value.start_date ?? ""),
    curve_version: Number(value.curve_version ?? 1),
    current_day_no: Number(value.current_day_no ?? 0),
    er_aktiv: Boolean(value.er_aktiv),
    n_sellers: value.n_sellers ?? null,
    my_days: Array.isArray(value.my_days) ? value.my_days : [],
    band: value.band,
  };
}

/**
 * Opstartskurve ("Din opstart") for den aktuelle bruger eller — for ledelsen —
 * for en navngiven sælger. Adgangskontrollen ligger i databasefunktionerne.
 */
export function useEmployeeRamp(employeeId?: string) {
  return useQuery({
    queryKey: ["employee-ramp", employeeId ?? "me"],
    queryFn: async (): Promise<RampData | null> => {
      if (employeeId) {
        const { data, error } = await supabase.rpc("get_ramp_for_employee", {
          p_employee_id: employeeId,
        });
        if (error) throw error;
        return parseRamp(data);
      }
      const { data, error } = await supabase.rpc("get_my_ramp");
      if (error) throw error;
      return parseRamp(data);
    },
    staleTime: 5 * 60 * 1000,
  });
}
