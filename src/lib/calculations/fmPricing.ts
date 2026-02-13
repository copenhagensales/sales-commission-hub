/**
 * FM Pricing Helper
 * 
 * Provides correct pricing lookup for Field Marketing sales by following
 * the pricing rule hierarchy:
 *   1. Active product_pricing_rules (highest priority wins)
 *   2. Base prices from products table (fallback)
 * 
 * FM sales don't have sale_items, so we need to look up prices by product name.
 */

import { supabase } from "@/integrations/supabase/client";

interface FmPricing {
  commission: number;
  revenue: number;
}

/**
 * Build a pricing map for FM products: product_name (lowercase) -> { commission, revenue }
 * 
 * This follows the same hierarchy as the backend pricing-service.ts:
 * 1. Check product_pricing_rules (active, highest priority wins)
 * 2. Fallback to products.commission_dkk / revenue_dkk
 */
export async function buildFmPricingMap(): Promise<Map<string, FmPricing>> {
  // Fetch products (base prices) and active pricing rules in parallel
  const [productsResult, rulesResult] = await Promise.all([
    supabase.from("products").select("id, name, commission_dkk, revenue_dkk"),
    supabase
      .from("product_pricing_rules")
      .select("product_id, commission_dkk, revenue_dkk, priority, campaign_mapping_ids")
      .eq("is_active", true)
      .order("priority", { ascending: false }),
  ]);

  const products = productsResult.data || [];
  const rules = rulesResult.data || [];

  // Build override map: product_id -> { commission, revenue } (highest priority, universal rules preferred for FM)
  const overrideByProductId = new Map<string, FmPricing>();
  
  // Rules are already sorted by priority desc, so first match wins
  for (const rule of rules) {
    if (!rule.product_id) continue;
    // For FM, we only use universal rules (no campaign restriction) since FM has no campaign mapping
    const hasCampaignRestriction = rule.campaign_mapping_ids && rule.campaign_mapping_ids.length > 0;
    if (hasCampaignRestriction) continue;
    
    if (!overrideByProductId.has(rule.product_id)) {
      overrideByProductId.set(rule.product_id, {
        commission: rule.commission_dkk ?? 0,
        revenue: rule.revenue_dkk ?? 0,
      });
    }
  }

  // Build final map: product_name (lowercase) -> pricing
  const pricingMap = new Map<string, FmPricing>();
  
  for (const product of products) {
    if (!product.name) continue;
    const override = overrideByProductId.get(product.id);
    pricingMap.set(product.name.toLowerCase(), {
      commission: override?.commission ?? product.commission_dkk ?? 0,
      revenue: override?.revenue ?? product.revenue_dkk ?? 0,
    });
  }

  return pricingMap;
}

/**
 * Synchronous version: build FM pricing map from pre-fetched data.
 * Use this when you already have products and pricing rules loaded.
 */
export function buildFmPricingMapSync(
  products: Array<{ id: string; name: string; commission_dkk: number | null; revenue_dkk: number | null }>,
  pricingRules: Array<{ product_id: string; commission_dkk: number | null; revenue_dkk: number | null; priority: number; campaign_mapping_ids: string[] | null }>
): Map<string, FmPricing> {
  // Build override map from universal rules (no campaign restriction)
  const overrideByProductId = new Map<string, FmPricing>();
  
  // Sort by priority desc
  const sortedRules = [...pricingRules].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  
  for (const rule of sortedRules) {
    if (!rule.product_id) continue;
    const hasCampaignRestriction = rule.campaign_mapping_ids && rule.campaign_mapping_ids.length > 0;
    if (hasCampaignRestriction) continue;
    
    if (!overrideByProductId.has(rule.product_id)) {
      overrideByProductId.set(rule.product_id, {
        commission: rule.commission_dkk ?? 0,
        revenue: rule.revenue_dkk ?? 0,
      });
    }
  }

  const pricingMap = new Map<string, FmPricing>();
  
  for (const product of products) {
    if (!product.name) continue;
    const override = overrideByProductId.get(product.id);
    pricingMap.set(product.name.toLowerCase(), {
      commission: override?.commission ?? product.commission_dkk ?? 0,
      revenue: override?.revenue ?? product.revenue_dkk ?? 0,
    });
  }

  return pricingMap;
}
