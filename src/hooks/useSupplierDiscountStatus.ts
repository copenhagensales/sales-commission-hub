import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupplierDiscountStatus {
  basis: number;
  currentPercent: number;
  currentRuleId: string | null;
  nextMinRevenue: number | null;
  nextPercent: number | null;
  remainingToNext: number | null;
}

/**
 * Leverandørens kumulerede grundlag og aktuelle rabattrin (annual_revenue).
 * Satsen gælder NYE bookinger — ikke bookinger der allerede er stemplet.
 * Returnerer null når leverandøren ikke har aktive annual_revenue-regler.
 */
export function useSupplierDiscountStatus(locationType?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["supplier-discount-status", locationType],
    queryFn: async (): Promise<SupplierDiscountStatus | null> => {
      if (!locationType) return null;
      const { data, error } = await supabase.rpc("get_supplier_discount_status", {
        p_location_type: locationType,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return {
        basis: Number(row.basis ?? 0),
        currentPercent: Number(row.current_percent ?? 0),
        currentRuleId: row.current_rule_id ?? null,
        nextMinRevenue: row.next_min_revenue == null ? null : Number(row.next_min_revenue),
        nextPercent: row.next_percent == null ? null : Number(row.next_percent),
        remainingToNext: row.remaining_to_next == null ? null : Number(row.remaining_to_next),
      };
    },
    enabled: enabled && !!locationType,
  });
}

/** Har leverandøren (location.type) aktive annual_revenue-rabatregler? */
export function useHasAnnualRevenueRules(locationType?: string | null) {
  return useQuery({
    queryKey: ["supplier-annual-revenue-rules", locationType],
    queryFn: async () => {
      if (!locationType) return false;
      const { data, error } = await supabase
        .from("supplier_discount_rules")
        .select("id")
        .eq("location_type", locationType)
        .eq("discount_type", "annual_revenue")
        .eq("is_active", true)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!locationType,
  });
}
