import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RematchParams {
  productId?: string;
  effectiveFromDate?: string;
  dryRun?: boolean;
}

interface RematchResult {
  success: boolean;
  dry_run: boolean;
  stats: {
    total: number;
    matched: number;
    baseProductFallback: number;
    noMatch: number;
    productsCorrected: number;
    updated: number;
  };
  ruleStats?: Record<string, number>;
  sampleMatches?: Array<{
    saleItemId: string;
    productId: string;
    originalProductId: string;
    ruleName: string;
    commission: number;
    revenue: number;
  }>;
  error?: string;
}

export function useRematchPricingRules() {
  return useMutation<RematchResult, Error, RematchParams>({
    mutationFn: async ({ productId, effectiveFromDate, dryRun = false }) => {
      const response = await supabase.functions.invoke("rematch-pricing-rules", {
        body: {
          product_id: productId,
          effective_from_date: effectiveFromDate,
          dry_run: dryRun,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Failed to rematch pricing rules");
      }

      return response.data as RematchResult;
    },
    onSuccess: (data, variables) => {
      if (variables.dryRun) {
        toast.info(`Vil opdatere ${data.stats.total} salg (${data.stats.matched} med regler, ${data.stats.baseProductFallback} med basispriser)`);
      } else if (data.stats.updated > 0) {
        toast.success(`Opdaterede ${data.stats.updated} salg med nye priser`);
      }
    },
    onError: (error) => {
      toast.error("Kunne ikke opdatere prisdata: " + error.message);
    },
  });
}
