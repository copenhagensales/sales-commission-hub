/**
 * FM Pricing Helper
 *
 * Provides correct pricing lookup for Field Marketing sales by following
 * the pricing rule hierarchy:
 *   1. Active product_pricing_rules (highest priority wins, campaign-aware)
 *   2. Base prices from products table (fallback)
 *
 * FM sales don't have sale_items, so we look up prices by product name.
 * FM sales DO have a campaign context via `client_campaign_id` (mapped through
 * adversus_campaign_mappings → campaign_mapping.id), so the lookup is
 * campaign-aware: pass the campaign mapping id to honor include/exclude rules.
 */

import { supabase } from "@/integrations/supabase/client";
import { ruleMatchesCampaign, type CampaignMatchMode } from "./pricingRuleMatching";

export interface FmPricing {
  commission: number;
  revenue: number;
}

interface ProductRow {
  id: string;
  name: string | null;
  commission_dkk: number | null;
  revenue_dkk: number | null;
}

interface PricingRuleRow {
  product_id: string;
  commission_dkk: number | null;
  revenue_dkk: number | null;
  priority: number;
  campaign_mapping_ids: string[] | null;
  campaign_match_mode?: CampaignMatchMode | null;
}

/**
 * Lookup function returned by the pricing builders.
 * Pass `campaignMappingId` (the id of `adversus_campaign_mappings`, NOT the dialer id)
 * to evaluate include/exclude rules. Omit it for backward-compatible
 * "universal-only" behaviour.
 */
export type FmPricingLookup = (
  productName: string,
  campaignMappingId?: string | null,
) => FmPricing;

function buildLookup(
  products: ProductRow[],
  pricingRules: PricingRuleRow[],
): FmPricingLookup {
  // Group rules by product_id, sorted by priority desc (first match wins).
  const rulesByProductId = new Map<string, PricingRuleRow[]>();
  for (const rule of pricingRules) {
    if (!rule.product_id) continue;
    const list = rulesByProductId.get(rule.product_id) || [];
    list.push(rule);
    rulesByProductId.set(rule.product_id, list);
  }
  for (const list of rulesByProductId.values()) {
    list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  // product_name (lowercase) -> base ProductRow
  const productByName = new Map<string, ProductRow>();
  for (const product of products) {
    if (!product.name) continue;
    productByName.set(product.name.toLowerCase(), product);
  }

  return (productName: string, campaignMappingId?: string | null): FmPricing => {
    const key = productName?.toLowerCase();
    const product = key ? productByName.get(key) : undefined;
    if (!product) return { commission: 0, revenue: 0 };

    const rules = rulesByProductId.get(product.id) || [];
    for (const rule of rules) {
      if (
        ruleMatchesCampaign(
          rule.campaign_mapping_ids,
          rule.campaign_match_mode ?? "include",
          campaignMappingId ?? null,
        )
      ) {
        return {
          commission: rule.commission_dkk ?? 0,
          revenue: rule.revenue_dkk ?? 0,
        };
      }
    }

    return {
      commission: product.commission_dkk ?? 0,
      revenue: product.revenue_dkk ?? 0,
    };
  };
}

/**
 * Async: fetch products + active pricing rules and return a campaign-aware lookup.
 */
export async function buildFmPricingLookup(): Promise<FmPricingLookup> {
  const [productsResult, rulesResult] = await Promise.all([
    supabase.from("products").select("id, name, commission_dkk, revenue_dkk"),
    supabase
      .from("product_pricing_rules")
      .select(
        "product_id, commission_dkk, revenue_dkk, priority, campaign_mapping_ids, campaign_match_mode",
      )
      .eq("is_active", true)
      .order("priority", { ascending: false }),
  ]);

  return buildLookup(
    (productsResult.data || []) as ProductRow[],
    (rulesResult.data || []) as PricingRuleRow[],
  );
}

/**
 * Sync: build lookup from already-fetched products + rules.
 */
export function buildFmPricingLookupSync(
  products: ProductRow[],
  pricingRules: PricingRuleRow[],
): FmPricingLookup {
  return buildLookup(products, pricingRules);
}

// ---------------------------------------------------------------------------
// Backward-compatible Map-based API (used by older code paths). The map is
// derived from a "universal-only" lookup (no campaign context), preserving
// the previous behaviour: rules with campaign restrictions are skipped.
// ---------------------------------------------------------------------------

export async function buildFmPricingMap(): Promise<Map<string, FmPricing>> {
  const [productsResult, rulesResult] = await Promise.all([
    supabase.from("products").select("id, name, commission_dkk, revenue_dkk"),
    supabase
      .from("product_pricing_rules")
      .select(
        "product_id, commission_dkk, revenue_dkk, priority, campaign_mapping_ids, campaign_match_mode",
      )
      .eq("is_active", true)
      .order("priority", { ascending: false }),
  ]);
  return mapFromLookupInputs(
    (productsResult.data || []) as ProductRow[],
    (rulesResult.data || []) as PricingRuleRow[],
  );
}

export function buildFmPricingMapSync(
  products: ProductRow[],
  pricingRules: PricingRuleRow[],
): Map<string, FmPricing> {
  return mapFromLookupInputs(products, pricingRules);
}

function mapFromLookupInputs(
  products: ProductRow[],
  pricingRules: PricingRuleRow[],
): Map<string, FmPricing> {
  const lookup = buildLookup(products, pricingRules);
  const map = new Map<string, FmPricing>();
  for (const product of products) {
    if (!product.name) continue;
    map.set(product.name.toLowerCase(), lookup(product.name, null));
  }
  return map;
}
