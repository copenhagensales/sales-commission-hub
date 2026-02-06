import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Correct product IDs for ASE
const ASE_SALG_PRODUCT_ID = "1ad52862-2102-472e-9cdf-52f9c76997a2";
const ASE_LEAD_PRODUCT_ID = "e360f3c2-b448-474b-bbf8-e7dc629a0d2a";

// Types for pricing rules
interface NumericCondition {
  operator: "gte" | "lte" | "gt" | "lt";
  value: number;
}

interface PricingRule {
  id: string;
  product_id: string;
  name: string;
  conditions: Record<string, string | NumericCondition>;
  commission_dkk: number;
  revenue_dkk: number;
  priority: number;
  is_active: boolean;
  campaign_mapping_ids?: string[] | null;
  allows_immediate_payment?: boolean | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

function isNumericCondition(value: unknown): value is NumericCondition {
  return typeof value === "object" && value !== null && "operator" in value && "value" in value;
}

function evaluateNumericCondition(condition: NumericCondition, leadValue: string | undefined): boolean {
  const numericLeadValue = parseFloat(leadValue || "0");
  if (isNaN(numericLeadValue)) return false;

  switch (condition.operator) {
    case "gte":
      return numericLeadValue >= condition.value;
    case "lte":
      return numericLeadValue <= condition.value;
    case "gt":
      return numericLeadValue > condition.value;
    case "lt":
      return numericLeadValue < condition.value;
    default:
      return false;
  }
}

/**
 * Determine the correct product for an ASE sale based on lead data.
 * - If 'Ja - Afdeling' is 'Lead', it's a Lead product
 * - Otherwise it's a Salg product (A-kasse sales)
 */
function determineAseProductId(rawPayloadData: Record<string, unknown> | undefined): string {
  if (!rawPayloadData) return ASE_SALG_PRODUCT_ID;
  
  const jaAfdeling = rawPayloadData["Ja - Afdeling"];
  if (jaAfdeling && String(jaAfdeling).toLowerCase() === "lead") {
    return ASE_LEAD_PRODUCT_ID;
  }
  
  return ASE_SALG_PRODUCT_ID;
}

/**
 * Match a pricing rule based on rawPayload.data conditions and date validity.
 * Returns the matching rule with highest priority, or null if no match.
 */
function matchPricingRule(
  productId: string,
  pricingRulesMap: Map<string, PricingRule[]>,
  rawPayloadData: Record<string, unknown> | undefined,
  campaignMappingId?: string | null,
  saleDate?: string | null // ISO date string for date-based filtering
): { commission: number; revenue: number; ruleId: string; ruleName: string; allowsImmediatePayment: boolean } | null {
  const rules = pricingRulesMap.get(productId);
  if (!rules || rules.length === 0) return null;

  // Convert rawPayload.data object to array format for matching
  const allFields: Array<{ label: string; value: string }> = [];
  if (rawPayloadData && typeof rawPayloadData === "object") {
    for (const [key, value] of Object.entries(rawPayloadData)) {
      if (value !== null && value !== undefined && value !== "") {
        allFields.push({ label: key, value: String(value) });
      }
    }
  }

  // Sort by priority descending (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  // Parse sale date for date-based filtering
  const saleDateObj = saleDate ? new Date(saleDate) : null;
  const saleDateStr = saleDateObj ? saleDateObj.toISOString().split('T')[0] : null;

  const hasConditionalRules = sortedRules.some((r) => r.is_active && Object.keys(r.conditions || {}).length > 0);
  const hasEmptyLeadData = allFields.length === 0;

  for (const rule of sortedRules) {
    if (!rule.is_active) continue;

    // Date-based filtering: skip rules outside their validity window
    if (saleDateStr) {
      // If rule has effective_from and sale date is before it, skip
      if (rule.effective_from && saleDateStr < rule.effective_from) {
        continue;
      }
      // If rule has effective_to and sale date is on or after it, skip
      if (rule.effective_to && saleDateStr >= rule.effective_to) {
        continue;
      }
    }

    const hasCampaignRestriction = rule.campaign_mapping_ids && rule.campaign_mapping_ids.length > 0;
    const campaignMatches =
      hasCampaignRestriction && campaignMappingId && rule.campaign_mapping_ids!.includes(campaignMappingId);

    // Check campaign restriction if rule has campaign_mapping_ids
    if (hasCampaignRestriction && !campaignMatches) {
      continue;
    }

    // Check all conditions match
    const conditions = rule.conditions || {};
    const conditionKeys = Object.keys(conditions);
    let allConditionsMet = true;

    for (const [condKey, condValue] of Object.entries(conditions)) {
      const leadField = allFields.find((f) => f.label === condKey);

      if (isNumericCondition(condValue)) {
        if (!evaluateNumericCondition(condValue, leadField?.value)) {
          allConditionsMet = false;
          break;
        }
      } else {
        if (!leadField || leadField.value !== condValue) {
          allConditionsMet = false;
          break;
        }
      }
    }

    // Campaign fallback logic
    if (!allConditionsMet && conditionKeys.length > 0 && hasEmptyLeadData && campaignMatches) {
      return {
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk,
        ruleId: rule.id,
        ruleName: rule.name,
        allowsImmediatePayment: rule.allows_immediate_payment ?? false,
      };
    }

    if (allConditionsMet) {
      return {
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk,
        ruleId: rule.id,
        ruleName: rule.name,
        allowsImmediatePayment: rule.allows_immediate_payment ?? false,
      };
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const source = body.source as string | undefined; // e.g., 'ase'
    const productId = body.product_id as string | undefined; // NEW: filter by specific product
    const limit = body.limit as number | undefined; // optional limit
    const dryRun = body.dry_run === true;

    console.log(`[rematch-pricing-rules] Starting with source=${source || "all"}, product_id=${productId || "all"}, limit=${limit || "none"}, dry_run=${dryRun}`);

    // Fetch sale_items - either all for specific product, or unmatched items
    let query = supabase
      .from("sale_items")
      .select(`
        id,
        sale_id,
        product_id,
        quantity,
        matched_pricing_rule_id,
        mapped_commission,
        mapped_revenue,
        needs_mapping,
        sales!inner (
          id,
          source,
          raw_payload,
          dialer_campaign_id,
          sale_datetime
        )
      `);

    // If product_id is specified, rematch ALL items for that product (for price updates)
    if (productId) {
      query = query.eq("product_id", productId);
    } else {
      // Otherwise, only process items without matched rule and zero commission
      query = query
        .is("matched_pricing_rule_id", null)
        .not("product_id", "is", null)
        .eq("mapped_commission", 0);
    }

    if (source) {
      query = query.eq("sales.source", source);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: saleItems, error: itemsError } = await query;

    if (itemsError) {
      console.error("[rematch-pricing-rules] Error fetching sale_items:", itemsError);
      throw new Error(`Failed to fetch sale_items: ${itemsError.message}`);
    }

    console.log(`[rematch-pricing-rules] Found ${saleItems?.length || 0} sale_items to process`);

    if (!saleItems || saleItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No sale_items found needing rematching",
          stats: { total: 0, matched: 0, noMatch: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch all active pricing rules (include effective dates)
    const { data: pricingRules, error: rulesError } = await supabase
      .from("product_pricing_rules")
      .select("id, product_id, name, conditions, commission_dkk, revenue_dkk, priority, is_active, campaign_mapping_ids, allows_immediate_payment, effective_from, effective_to")
      .eq("is_active", true);

    if (rulesError) {
      console.error("[rematch-pricing-rules] Error fetching pricing rules:", rulesError);
      throw new Error(`Failed to fetch pricing rules: ${rulesError.message}`);
    }

    // Build pricing rules map
    const pricingRulesMap = new Map<string, PricingRule[]>();
    if (pricingRules) {
      for (const rule of pricingRules) {
        const existing = pricingRulesMap.get(rule.product_id) || [];
        existing.push(rule as PricingRule);
        pricingRulesMap.set(rule.product_id, existing);
      }
    }

    console.log(`[rematch-pricing-rules] Loaded ${pricingRules?.length || 0} active pricing rules for ${pricingRulesMap.size} products`);

    // Fetch all products with base prices for fallback
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, commission_dkk, revenue_dkk");

    if (productsError) {
      console.error("[rematch-pricing-rules] Error fetching products:", productsError);
    }

    const productsMap = new Map<string, { commission_dkk: number; revenue_dkk: number }>();
    if (products) {
      for (const product of products) {
        productsMap.set(product.id, {
          commission_dkk: product.commission_dkk || 0,
          revenue_dkk: product.revenue_dkk || 0,
        });
      }
    }

    console.log(`[rematch-pricing-rules] Loaded ${productsMap.size} products with base prices for fallback`);

    // Get unique campaign IDs and fetch their mapping IDs
    const campaignIds = [...new Set(saleItems.map((si) => si.sales?.dialer_campaign_id).filter(Boolean))];
    const campaignMappingsMap = new Map<string, string>();

    if (campaignIds.length > 0) {
      const { data: campaignMappings } = await supabase
        .from("adversus_campaign_mappings")
        .select("id, adversus_campaign_id")
        .in("adversus_campaign_id", campaignIds);

      if (campaignMappings) {
        for (const mapping of campaignMappings) {
          campaignMappingsMap.set(mapping.adversus_campaign_id, mapping.id);
        }
      }
    }

    // Process each sale_item
    const updates: { id: string; product_id: string; matched_pricing_rule_id: string | null; mapped_commission: number; mapped_revenue: number; needs_mapping: boolean }[] = [];
    let matchedCount = 0;
    let noMatchCount = 0;
    let productCorrectedCount = 0;
    let baseProductFallbackCount = 0;
    const matchDetails: { saleItemId: string; productId: string; originalProductId: string; ruleName: string; commission: number; revenue: number }[] = [];

    for (const item of saleItems) {
      // Extract raw_payload.data
      const rawPayload = item.sales?.raw_payload as Record<string, unknown> | null;
      const rawPayloadData = rawPayload?.data as Record<string, unknown> | undefined;

      // Determine correct product ID for ASE sales based on lead data
      const isAse = source === "ase" || item.sales?.source === "ase";
      const originalProductId = item.product_id;
      const correctProductId = isAse ? determineAseProductId(rawPayloadData) : originalProductId;
      
      const productWasCorrected = correctProductId !== originalProductId;
      if (productWasCorrected) {
        productCorrectedCount++;
      }

      // Get campaign mapping ID
      const campaignId = item.sales?.dialer_campaign_id;
      const campaignMappingId = campaignId ? campaignMappingsMap.get(campaignId) : null;

      // Get sale date for date-based rule filtering
      const saleDate = (item.sales as { sale_datetime?: string })?.sale_datetime || null;

      // Try to match a pricing rule with the correct product ID and sale date
      const matchedRule = matchPricingRule(correctProductId, pricingRulesMap, rawPayloadData, campaignMappingId, saleDate);

      if (matchedRule) {
        const qty = item.quantity || 1;
        const commission = matchedRule.commission * qty;
        const revenue = matchedRule.revenue * qty;

        updates.push({
          id: item.id,
          product_id: correctProductId,
          matched_pricing_rule_id: matchedRule.ruleId,
          mapped_commission: commission,
          mapped_revenue: revenue,
          needs_mapping: false,
        });

        matchDetails.push({
          saleItemId: item.id,
          productId: correctProductId,
          originalProductId: originalProductId || "null",
          ruleName: matchedRule.ruleName,
          commission,
          revenue,
        });

        matchedCount++;
      } else {
        // No pricing rule matched - fallback to product base price
        const baseProduct = productsMap.get(correctProductId);
        if (baseProduct && (baseProduct.commission_dkk > 0 || baseProduct.revenue_dkk > 0)) {
          const qty = item.quantity || 1;
          updates.push({
            id: item.id,
            product_id: correctProductId,
            matched_pricing_rule_id: null,
            mapped_commission: baseProduct.commission_dkk * qty,
            mapped_revenue: baseProduct.revenue_dkk * qty,
            needs_mapping: false,
          });
          baseProductFallbackCount++;
          matchDetails.push({
            saleItemId: item.id,
            productId: correctProductId,
            originalProductId: originalProductId || "null",
            ruleName: "BASE_PRODUCT_PRICE",
            commission: baseProduct.commission_dkk * qty,
            revenue: baseProduct.revenue_dkk * qty,
          });
        } else if (productWasCorrected) {
          // Product was corrected but no base price - still update product_id
          updates.push({
            id: item.id,
            product_id: correctProductId,
            matched_pricing_rule_id: null,
            mapped_commission: 0,
            mapped_revenue: 0,
            needs_mapping: false,
          });
          noMatchCount++;
        } else {
          noMatchCount++;
        }
      }
    }

    console.log(`[rematch-pricing-rules] Matched: ${matchedCount}, Base fallback: ${baseProductFallbackCount}, No match: ${noMatchCount}, Products corrected: ${productCorrectedCount}`);

    // Log sample matches
    if (matchDetails.length > 0) {
      console.log(`[rematch-pricing-rules] Sample matches (first 5):`);
      for (const detail of matchDetails.slice(0, 5)) {
        console.log(`  - ${detail.saleItemId}: ${detail.ruleName} -> ${detail.commission} DKK commission, ${detail.revenue} DKK revenue`);
      }
    }

    // Apply updates if not dry run
    if (!dryRun && updates.length > 0) {
      console.log(`[rematch-pricing-rules] Applying ${updates.length} updates...`);

      // Batch updates in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);

        for (const update of chunk) {
          const { error: updateError } = await supabase
            .from("sale_items")
            .update({
              product_id: update.product_id,
              matched_pricing_rule_id: update.matched_pricing_rule_id,
              mapped_commission: update.mapped_commission,
              mapped_revenue: update.mapped_revenue,
              needs_mapping: update.needs_mapping,
            })
            .eq("id", update.id);

          if (updateError) {
            console.error(`[rematch-pricing-rules] Error updating sale_item ${update.id}:`, updateError);
          }
        }

        console.log(`[rematch-pricing-rules] Updated ${Math.min(i + chunkSize, updates.length)}/${updates.length}`);
      }

      console.log(`[rematch-pricing-rules] Successfully updated ${updates.length} sale_items`);
    } else if (dryRun) {
      console.log(`[rematch-pricing-rules] DRY RUN - No updates applied`);
    }

    // Count by rule for statistics
    const ruleStats = new Map<string, number>();
    for (const detail of matchDetails) {
      const count = ruleStats.get(detail.ruleName) || 0;
      ruleStats.set(detail.ruleName, count + 1);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        stats: {
          total: saleItems.length,
          matched: matchedCount,
          baseProductFallback: baseProductFallbackCount,
          noMatch: noMatchCount,
          productsCorrected: productCorrectedCount,
          updated: dryRun ? 0 : updates.length,
        },
        ruleStats: Object.fromEntries(ruleStats),
        sampleMatches: matchDetails.slice(0, 10),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[rematch-pricing-rules] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
