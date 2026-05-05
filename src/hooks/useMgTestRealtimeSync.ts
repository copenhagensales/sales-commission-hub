import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Listens for `pricing_rules_updated` broadcasts on the `mg-test-sync` channel
 * and invalidates all queries that depend on pricing/sales/mappings/products.
 *
 * Mount once at app root so every open session/dashboard auto-refreshes when
 * a teammate edits a pricing rule, mapping, or product on MgTest.
 */
const QUERY_KEYS_TO_INVALIDATE = [
  "pricing-rules",
  "product-pricing-rules",
  "product-campaign-overrides",
  "mg-aggregated-products",
  "mg-manual-products",
  "products",
  "needs-mapping",
  "mg-needs-mapping-items",
  "mg-mapped-product-ids",
  "aggregated-product-types",
  "dashboard-sales-data",
  "daily-revenue-chart",
  "daily-reports",
  "sales-aggregates",
  "sales",
  "sale_items",
  "sale-items",
  "adversus-campaign-mappings",
  "adversus-product-mappings",
  "client-campaigns",
  "mg-campaign-mappings",
  "mg-client-campaigns",
];

export function useMgTestRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("mg-test-sync")
      .on("broadcast", { event: "pricing_rules_updated" }, () => {
        for (const key of QUERY_KEYS_TO_INVALIDATE) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
