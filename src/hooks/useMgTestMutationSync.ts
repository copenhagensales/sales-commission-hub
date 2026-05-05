import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useRematchPricingRules } from "./useRematchPricingRules";

/**
 * Categories of queries to invalidate after a mutation on the MgTest page.
 * Compose these flags in `sync(...)` instead of remembering individual keys.
 */
export type MgTestInvalidationGroup =
  | "pricing"
  | "products"
  | "sales"
  | "mappings"
  | "fielddefs"
  | "kpi";

const QUERY_GROUPS: Record<Exclude<MgTestInvalidationGroup, "kpi">, string[]> = {
  pricing: [
    "pricing-rules",
    "product-pricing-rules",
    "product-campaign-overrides",
  ],
  products: [
    "mg-aggregated-products",
    "mg-manual-products",
    "products",
    "needs-mapping",
    "mg-needs-mapping-items",
    "mg-mapped-product-ids",
    "aggregated-product-types",
  ],
  sales: [
    "dashboard-sales-data",
    "daily-revenue-chart",
    "daily-reports",
    "sales-aggregates",
    "sales",
    "sale_items",
    "sale-items",
  ],
  mappings: [
    "adversus-campaign-mappings",
    "adversus-product-mappings",
    "client-campaigns",
    "mg-campaign-mappings",
    "mg-client-campaigns",
    "campaign-mappings-for-rules",
    "campaign-mappings-for-overrides",
  ],
  fielddefs: ["data-field-definitions", "integration-field-mappings"],
};

interface SyncOptions {
  /** Which query groups to invalidate. */
  invalidate: MgTestInvalidationGroup[];
  /** When true, run the rematch edge function in the background. */
  rematch?: boolean;
  /** Limit rematch to a single product. */
  productId?: string;
  /** Limit rematch to sales from this date onward (yyyy-mm-dd). */
  effectiveFromDate?: string;
  /** Optional friendly label used in toasts (e.g. "prisregel", "mapping"). */
  label?: string;
  /** Skip the success toast (e.g. caller already showed one). */
  silent?: boolean;
}

/**
 * Centralized post-mutation handler for MgTest page.
 *
 * Responsibilities:
 *   1. Invalidate React Query caches across the requested groups.
 *   2. Optionally fire the rematch edge function (price/commission recompute).
 *   3. Optionally invoke the KPI cache refresh edge function.
 *   4. Broadcast a realtime event so other open sessions refresh too.
 *   5. Show progress toasts.
 */
export function useMgTestMutationSync() {
  const queryClient = useQueryClient();
  const rematchMutation = useRematchPricingRules();

  const invalidateGroups = useCallback(
    (groups: MgTestInvalidationGroup[]) => {
      const seen = new Set<string>();
      for (const group of groups) {
        if (group === "kpi") continue;
        const keys = QUERY_GROUPS[group] || [];
        for (const key of keys) {
          if (seen.has(key)) continue;
          seen.add(key);
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    },
    [queryClient],
  );

  const broadcast = useCallback(async () => {
    try {
      const channel = supabase.channel("mg-test-sync");
      await channel.subscribe();
      await channel.send({
        type: "broadcast",
        event: "pricing_rules_updated",
        payload: { ts: Date.now() },
      });
      // Tear down the ephemeral channel.
      setTimeout(() => {
        supabase.removeChannel(channel);
      }, 500);
    } catch (err) {
      console.warn("[useMgTestMutationSync] broadcast failed", err);
    }
  }, []);

  const refreshKpi = useCallback(async () => {
    try {
      await supabase.functions.invoke("calculate-kpi-incremental", { body: {} });
    } catch (err) {
      console.warn("[useMgTestMutationSync] KPI refresh failed", err);
    }
  }, []);

  const sync = useCallback(
    (opts: SyncOptions) => {
      // 1. Invalidate immediately so UI reacts.
      invalidateGroups(opts.invalidate);

      // 2. Always broadcast so other sessions refresh too.
      void broadcast();

      // 3. KPI refresh (fire-and-forget) if requested.
      const wantsKpi = opts.invalidate.includes("kpi");
      if (wantsKpi) {
        void refreshKpi();
      }

      // 4. Rematch if requested.
      if (opts.rematch) {
        if (!opts.silent) {
          toast.info(`Opdaterer salg${opts.label ? ` (${opts.label})` : ""} i baggrunden...`);
        }
        rematchMutation.mutate(
          {
            productId: opts.productId,
            effectiveFromDate: opts.effectiveFromDate,
          },
          {
            onSuccess: (result) => {
              if (result.stats.updated > 0) {
                toast.success(
                  `✓ ${result.stats.updated} salg opdateret med nye priser`,
                );
              }
              // Re-invalidate sales after rematch persists new values.
              invalidateGroups(["sales", "products"]);
              if (wantsKpi) void refreshKpi();
              void broadcast();
            },
            onError: () => {
              toast.error("Baggrundsopdatering fejlede — kør rematch manuelt");
            },
          },
        );
      }
    },
    [broadcast, invalidateGroups, rematchMutation, refreshKpi],
  );

  return { sync, isRematching: rematchMutation.isPending };
}
