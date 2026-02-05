import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CLIENT_IDS } from "@/utils/clientIds";

const ASE_CLIENT_ID = CLIENT_IDS["Ase"];

interface SaleRow {
  id: string;
}

interface SaleItemRow {
  matched_pricing_rule_id: string | null;
}

interface PricingRuleRow {
  allows_immediate_payment: boolean | null;
}

/**
 * Hook to check if the current employee has any ASE sales with pricing rules
 * that allow immediate payment (allows_immediate_payment = true).
 * 
 * Used to dynamically show/hide the "Straksbetaling (ASE)" menu item.
 */
export function useHasImmediatePaymentSales() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["has-immediate-payment-sales", user?.email],
    queryFn: async (): Promise<boolean> => {
      if (!user?.email) return false;

      // 1. Find the employee by email
      const lowerEmail = user.email.toLowerCase();
      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (!employee) return false;

      // 2. Find agent IDs (emails) mapped to this employee
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("agent_id")
        .eq("employee_id", employee.id);

      if (!agentMappings || agentMappings.length === 0) return false;

      const agentEmails = agentMappings.map(m => m.agent_id);

      // 3. Find ASE campaign IDs
      const { data: aseCampaigns } = await supabase
        .from("client_campaigns")
        .select("id")
        .eq("client_id", ASE_CLIENT_ID);

      if (!aseCampaigns || aseCampaigns.length === 0) return false;

      const aseCampaignIds = aseCampaigns.map(c => c.id);

      // 4. Find sales for this agent in ASE campaigns
      // Use explicit type casts to avoid TS2589 with deeply nested Supabase types
      const allSaleIds: string[] = [];
      
      for (const agentEmail of agentEmails) {
        for (const campaignId of aseCampaignIds) {
          // @ts-expect-error Supabase type instantiation too deep
          const result = await supabase
            .from("sales")
            .select("id")
            .eq("campaign_id", campaignId)
            .eq("agent_email", agentEmail)
            .limit(10);
          
          const sales = (result.data || []) as SaleRow[];
          allSaleIds.push(...sales.map(s => s.id));
          
          if (allSaleIds.length >= 20) break;
        }
        if (allSaleIds.length >= 20) break;
      }

      if (allSaleIds.length === 0) return false;

      // 5. Check each sale for qualifying pricing rules
      for (const saleId of allSaleIds.slice(0, 20)) {
        const itemsResult = await supabase
          .from("sale_items")
          .select("matched_pricing_rule_id")
          .eq("sale_id", saleId)
          .not("matched_pricing_rule_id", "is", null);

        const items = (itemsResult.data || []) as SaleItemRow[];
        if (items.length === 0) continue;

        for (const item of items) {
          if (!item.matched_pricing_rule_id) continue;
          
          const ruleResult = await supabase
            .from("product_pricing_rules")
            .select("allows_immediate_payment")
            .eq("id", item.matched_pricing_rule_id)
            .maybeSingle();

          const rule = ruleResult.data as PricingRuleRow | null;
          if (rule?.allows_immediate_payment === true) {
            return true;
          }
        }
      }

      return false;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
