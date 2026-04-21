/**
 * Centralized Pricing Service
 * 
 * Single source of truth for all commission and revenue calculations.
 * Implements a two-tier fallback hierarchy:
 * 
 * Priority 1: product_pricing_rules (active rules with campaign/conditions matching)
 * Priority 2: products.commission_dkk / revenue_dkk (base fallback)
 * 
 * This ensures FM products (like Yousee) that don't have pricing rules 
 * still get their commission/revenue from the products table.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface PricingInfo {
  commission: number;
  revenue: number;
  source: 'pricing_rule' | 'product_base';
  ruleId?: string;
}

/**
 * Fetches a unified pricing map for FM (fieldmarketing) products.
 * 
 * Lookup hierarchy:
 * 1. First loads ALL products with base prices (commission_dkk, revenue_dkk)
 * 2. Then overrides with active product_pricing_rules (higher priority)
 * 
 * This ensures products without pricing rules still have pricing data.
 * 
 * @param supabase - Supabase client instance
 * @returns Map of product_name (lowercase) -> PricingInfo
 */
export async function getFmPricingMap(
  supabase: SupabaseClient
): Promise<Map<string, PricingInfo>> {
  const map = new Map<string, PricingInfo>();

  // 1. Load ALL products with base prices FIRST
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, commission_dkk, revenue_dkk");

  if (productsError) {
    console.error("[PricingService] Error fetching products:", productsError);
  }

  // Set base prices from products table
  for (const product of (products || [])) {
    const name = product.name?.toLowerCase();
    if (name && (product.commission_dkk !== null || product.revenue_dkk !== null)) {
      map.set(name, {
        commission: product.commission_dkk || 0,
        revenue: product.revenue_dkk || 0,
        source: 'product_base',
      });
    }
  }

  console.log(`[PricingService] Loaded ${map.size} products with base prices`);

  // 2. Override with active pricing rules (higher priority)
  // For FM (no campaign context here), only universal rules or "exclude" rules
  // (where the empty/null campaign id is NOT in the excluded list) apply.
  const { data: rules, error: rulesError } = await supabase
    .from("product_pricing_rules")
    .select(`
      id,
      product:products!inner(name),
      commission_dkk,
      revenue_dkk,
      priority,
      campaign_mapping_ids,
      campaign_match_mode
    `)
    .eq("is_active", true)
    .order("priority", { ascending: false, nullsFirst: true });

  if (rulesError) {
    console.error("[PricingService] Error fetching pricing rules:", rulesError);
  }

  // Track which products have been set by pricing rules (to get highest priority only)
  const rulesApplied = new Set<string>();

  for (const rule of (rules || [])) {
    const productData = rule.product as any;
    const name = productData?.name?.toLowerCase();
    if (!name || rulesApplied.has(name)) continue;

    const ids = rule.campaign_mapping_ids as string[] | null;
    const mode = rule.campaign_match_mode === "exclude" ? "exclude" : "include";
    const hasRestriction = !!ids && ids.length > 0;
    // No campaign context here → include rules with restriction skip; exclude rules apply.
    if (hasRestriction && mode === "include") continue;

    map.set(name, {
      commission: rule.commission_dkk || 0,
      revenue: rule.revenue_dkk || 0,
      source: 'pricing_rule',
      ruleId: rule.id,
    });
    rulesApplied.add(name);
  }

  console.log(`[PricingService] Applied ${rulesApplied.size} pricing rules (overriding base prices)`);
  console.log(`[PricingService] Final map size: ${map.size} products`);

  return map;
}

/**
 * Gets pricing for a specific product by name.
 * 
 * @param supabase - Supabase client instance
 * @param productName - Product name to look up
 * @returns PricingInfo or null if not found
 */
export async function getProductPricing(
  supabase: SupabaseClient,
  productName: string
): Promise<PricingInfo | null> {
  const map = await getFmPricingMap(supabase);
  return map.get(productName.toLowerCase()) || null;
}

/**
 * Gets pricing for a specific product by ID.
 * 
 * @param supabase - Supabase client instance
 * @param productId - Product UUID to look up
 * @returns PricingInfo or null if not found
 */
export async function getProductPricingById(
  supabase: SupabaseClient,
  productId: string
): Promise<PricingInfo | null> {
  // First check for active pricing rules
  const { data: rule } = await supabase
    .from("product_pricing_rules")
    .select("id, commission_dkk, revenue_dkk")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rule) {
    return {
      commission: rule.commission_dkk || 0,
      revenue: rule.revenue_dkk || 0,
      source: 'pricing_rule',
      ruleId: rule.id,
    };
  }

  // Fallback to product base price
  const { data: product } = await supabase
    .from("products")
    .select("commission_dkk, revenue_dkk")
    .eq("id", productId)
    .maybeSingle();

  if (product) {
    return {
      commission: product.commission_dkk || 0,
      revenue: product.revenue_dkk || 0,
      source: 'product_base',
    };
  }

  return null;
}
