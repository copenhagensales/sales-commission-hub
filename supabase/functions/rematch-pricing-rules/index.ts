import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Correct product IDs for ASE
const ASE_SALG_PRODUCT_ID = "1ad52862-2102-472e-9cdf-52f9c76997a2";
const ASE_LEAD_PRODUCT_ID = "e360f3c2-b448-474b-bbf8-e7dc629a0d2a";
const ASE_LOENSIKRING_PRODUCT_ID = "f9a8362f-3839-4247-961c-d5cd1e7cd37d";

// All Lønsikring variant product IDs that should be normalized to the standard one
const LOENSIKRING_VARIANT_IDS = new Set([
  "fb4763a0-ae8e-4abf-85da-30da06a56294",  // Lønsikring Udvidet - 6000
  "e1d43ddb-4340-4066-a1b8-b699d837f4ce",  // Lønsikring Udvidet
  "b75db9ae-f486-4385-ae9e-a065b51e2481",  // Lønsikring Udvidet - 18000
  "acc29102-1e2c-495e-b5e6-feb90ef932b6",  // Lønsikring Udvidet - 16000
  "fe1fc1e7-2fbb-4f84-8679-3f032864213a",  // Lønsikring Udvidet - 19000
  "379be89f-4e17-4a22-ac65-136ba0d421d2",  // Lønsikring Udvidet - 50000
  "ca2730b0-97f3-4133-8f6d-1b22a9236bb9",  // Lønsikring Super
  "7cd5a845-3ffb-4696-857d-8d4499b5216f",  // Lønsikring Super - 6000
  "bfd4c21f-76db-4450-b928-3ae6a5deeb0c",  // Lønsikring under 5000
  "965abda5-5ae8-4fe6-acd8-2ec4dcc9b603",  // Fagforening med lønsikring
]);

// Key normalization map for ASE raw_payload data (lowercase -> correct casing)
const ASE_KEY_MAP: Record<string, string> = {
  "a-kasse salg": "A-kasse salg",
  "a-kasse type": "A-kasse type",
  "dækningssum": "Dækningssum",
  "daekningssum": "Dækningssum",
  "forening": "Forening",
  "lønsikring": "Lønsikring",
  "loensikring": "Lønsikring",
  "eksisterende medlem": "Eksisterende medlem",
  "medlemsnummer": "Medlemsnummer",
  "nuværende a-kasse": "Nuværende a-kasse",
  "nuvaerende a-kasse": "Nuværende a-kasse",
  "resultat af samtalen": "Resultat af samtalen",
  "ja - afdeling": "Ja - Afdeling",
  "leadudfald": "Leadudfald",
  "navn1": "Navn1",
  "navn2": "Navn2",
  "telefon1": "Telefon1",
};

/**
 * Normalize raw_payload keys for ASE sales to ensure correct casing.
 * Historical records may have lowercase keys from the /leads endpoint.
 */
function normalizeRawPayloadKeys(data: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const mappedKey = ASE_KEY_MAP[lowerKey];
    if (mappedKey) {
      normalized[mappedKey] = value;
    } else if (key !== lowerKey) {
      normalized[key] = value;
    } else {
      normalized[key.charAt(0).toUpperCase() + key.slice(1)] = value;
    }
  }
  return normalized;
}

// Types for pricing rules
interface NumericCondition {
  operator: "gte" | "lte" | "gt" | "lt" | "between" | "in";
  value: number;
  value2?: number;
  values?: number[];
}


interface SaleJoinData {
  id?: string;
  source?: string | null;
  raw_payload?: Record<string, unknown> | null;
  dialer_campaign_id?: string | null;
  sale_datetime?: string | null;
}

function normalizeJoinedSale(sales: unknown): SaleJoinData | null {
  if (Array.isArray(sales)) {
    const first = sales[0];
    return first && typeof first === "object" ? (first as SaleJoinData) : null;
  }
  return sales && typeof sales === "object" ? (sales as SaleJoinData) : null;
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
  immediate_payment_commission_dkk?: number | null;
  immediate_payment_revenue_dkk?: number | null;
  use_rule_name_as_display?: boolean | null;
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
    case "between":
      return numericLeadValue >= condition.value && numericLeadValue <= (condition.value2 ?? condition.value);
    case "in":
      return (condition.values ?? []).includes(numericLeadValue);
    default:
      return false;
  }
}

/**
 * Determine the correct product for an ASE sale based on lead data.
 * - If 'Ja - Afdeling' is 'Lead', it's a Lead product
 * - Otherwise it's a Salg product (A-kasse sales)
 */
function determineAseProductId(
  rawPayloadData: Record<string, unknown> | undefined,
  originalProductId?: string,
  adversusProductTitle?: string | null,
  hasOtherExplicitLoensikringInSale: boolean = false
): string {
  // Check if this is a Lønsikring variant - normalize to standard Lønsikring ID
  if (originalProductId && LOENSIKRING_VARIANT_IDS.has(originalProductId)) {
    return ASE_LOENSIKRING_PRODUCT_ID;
  }
  // If it's already the standard Lønsikring product, keep it
  if (originalProductId === ASE_LOENSIKRING_PRODUCT_ID) {
    return ASE_LOENSIKRING_PRODUCT_ID;
  }

  // Check adversus_product_title for Lønsikring patterns (catches mismatched product_id)
  if (adversusProductTitle && /lønsikring/i.test(adversusProductTitle)) {
    console.log(
      `[rematch-pricing-rules] Product title "${adversusProductTitle}" indicates Lønsikring, correcting product_id`
    );
    return ASE_LOENSIKRING_PRODUCT_ID;
  }

  // Check raw_payload for Lønsikring patterns (catches items where product_id is "Salg"
  // but raw_payload contains Lønsikring data like "Lønsikring Udvidet")
  // IMPORTANT: Only do this if the sale does NOT already contain an explicit Lønsikring item,
  // otherwise we risk creating duplicate Lønsikring commission on the same sale.
  if (rawPayloadData && !hasOtherExplicitLoensikringInSale) {
    const loensikringValue = rawPayloadData["Lønsikring"] as string | undefined;
    if (loensikringValue && /lønsikring/i.test(loensikringValue)) {
      console.log(
        `[rematch-pricing-rules] raw_payload Lønsikring="${loensikringValue}" → correcting to Lønsikring product`
      );
      return ASE_LOENSIKRING_PRODUCT_ID;
    }
  }

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
): { commission: number; revenue: number; ruleId: string; ruleName: string; allowsImmediatePayment: boolean; immediatePaymentCommission: number | null; immediatePaymentRevenue: number | null; displayName: string | null } | null {
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
      if (rule.effective_from && saleDateStr < rule.effective_from) {
        continue;
      }
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
        immediatePaymentCommission: rule.immediate_payment_commission_dkk ?? null,
        immediatePaymentRevenue: rule.immediate_payment_revenue_dkk ?? null,
        displayName: rule.use_rule_name_as_display ? rule.name : null,
      };
    }

    if (allConditionsMet) {
      return {
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk,
        ruleId: rule.id,
        ruleName: rule.name,
        allowsImmediatePayment: rule.allows_immediate_payment ?? false,
        immediatePaymentCommission: rule.immediate_payment_commission_dkk ?? null,
        immediatePaymentRevenue: rule.immediate_payment_revenue_dkk ?? null,
        displayName: rule.use_rule_name_as_display ? rule.name : null,
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
    const productId = body.product_id as string | undefined; // filter by specific product
    const saleIds = body.sale_ids as string[] | undefined; // filter by specific sale IDs
    const saleItemIds = body.sale_item_ids as string[] | undefined; // filter by specific sale_item IDs
    const limit = body.limit as number | undefined; // optional limit
    const dryRun = body.dry_run === true;

    console.log(`[rematch-pricing-rules] Starting with source=${source || "all"}, product_id=${productId || "all"}, sale_ids=${saleIds?.length || 0}, sale_item_ids=${saleItemIds?.length || 0}, limit=${limit || "none"}, dry_run=${dryRun}`);

    // Phase 0: Resolve needs_mapping items by looking up adversus_product_mappings
    const resolvedItemIds: string[] = [];
    {
      const { data: needsMappingItems, error: nmError } = await supabase
        .from("sale_items")
        .select("id, adversus_product_title, adversus_external_id, unit_price")
        .eq("needs_mapping", true)
        .is("product_id", null)
        .not("adversus_product_title", "is", null)
        .limit(1000);

      if (nmError) {
        console.error("[rematch-pricing-rules] Error fetching needs_mapping items:", nmError);
      } else if (needsMappingItems && needsMappingItems.length > 0) {
        console.log(`[rematch-pricing-rules] Found ${needsMappingItems.length} items with needs_mapping=true`);

        // Get all adversus_product_mappings (including unit_price for price-aware matching)
        const { data: mappings } = await supabase
          .from("adversus_product_mappings")
          .select("adversus_external_id, adversus_product_title, product_id, unit_price")
          .not("product_id", "is", null);

        if (mappings && mappings.length > 0) {
          // Build price-aware and generic lookup maps
          const priceSpecificMap = new Map<string, string>(); // "extId|price" -> product_id
          const titleMap = new Map<string, string>(); // title -> product_id (generic fallback)
          for (const m of mappings) {
            if (m.unit_price != null && m.adversus_external_id) {
              priceSpecificMap.set(`${m.adversus_external_id}|${m.unit_price}`, m.product_id!);
            }
            if (m.adversus_product_title && !titleMap.has(m.adversus_product_title)) {
              titleMap.set(m.adversus_product_title, m.product_id!);
            }
          }

          for (const item of needsMappingItems) {
            // Try price-specific mapping first, then title-based fallback
            const priceKey = item.adversus_external_id && item.unit_price != null 
              ? `${item.adversus_external_id}|${item.unit_price}` 
              : null;
            const resolvedProductId = (priceKey && priceSpecificMap.get(priceKey)) || titleMap.get(item.adversus_product_title!);
            
            if (resolvedProductId) {
              if (!dryRun) {
                const { error: updateErr } = await supabase
                  .from("sale_items")
                  .update({ product_id: resolvedProductId, needs_mapping: false })
                  .eq("id", item.id);

                if (updateErr) {
                  console.error(`[rematch-pricing-rules] Failed to resolve item ${item.id}:`, updateErr);
                } else {
                  resolvedItemIds.push(item.id);
                  console.log(`[rematch-pricing-rules] Resolved item ${item.id} → product ${resolvedProductId}`);
                }
              } else {
                resolvedItemIds.push(item.id);
                console.log(`[rematch-pricing-rules] [DRY RUN] Would resolve item ${item.id} → product ${resolvedProductId}`);
              }
            }
          }
          console.log(`[rematch-pricing-rules] Resolved ${resolvedItemIds.length} needs_mapping items`);
        }
      }
    }

    // Fetch sale_items with pagination to avoid 1000-row default limit
    const PAGE_SIZE = 1000;
    const saleItems: any[] = [];
    let offset = 0;
    let hasMore = true;

    const selectFields = `
      id,
      sale_id,
      product_id,
      quantity,
      matched_pricing_rule_id,
      mapped_commission,
      mapped_revenue,
      needs_mapping,
      is_immediate_payment,
      adversus_product_title,
      sales!inner (
        id,
        source,
        raw_payload,
        dialer_campaign_id,
        sale_datetime
      )
    `;

    while (hasMore) {
      let query = supabase
        .from("sale_items")
        .select(selectFields)
        .order("created_at", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);

      // Filter by specific sale_item IDs (highest priority)
      if (saleItemIds && saleItemIds.length > 0) {
        query = query.in("id", saleItemIds);
      } else if (saleIds && saleIds.length > 0) {
        query = query.in("sale_id", saleIds);
      } else if (productId) {
        query = query.eq("product_id", productId);
      } else {
        if (resolvedItemIds.length > 0) {
          query = query.or(
            `and(matched_pricing_rule_id.is.null,product_id.not.is.null),id.in.(${resolvedItemIds.join(",")})`
          );
        } else {
          query = query
            .is("matched_pricing_rule_id", null)
            .not("product_id", "is", null);
        }
      }

      if (source) {
        query = query.eq("sales.source", source);
      }

      if (limit && saleItems.length + PAGE_SIZE >= limit) {
        query = query.limit(limit - saleItems.length);
      }

      const { data, error: itemsError } = await query;

      if (itemsError) {
        console.error("[rematch-pricing-rules] Error fetching sale_items at offset", offset, itemsError);
        throw new Error(`Failed to fetch sale_items: ${itemsError.message}`);
      }

      if (data && data.length > 0) {
        saleItems.push(...data);
        offset += data.length;
        hasMore = data.length === PAGE_SIZE && (!limit || saleItems.length < limit);
      } else {
        hasMore = false;
      }
    }

    console.log(`[rematch-pricing-rules] Fetched ${saleItems.length} sale_items in ${Math.ceil(offset / PAGE_SIZE) || 1} page(s)`);

    if (saleItems.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No sale_items found needing rematching",
          stats: { total: 0, matched: 0, noMatch: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prefetch sibling sale_items metadata (needed to detect and prevent duplicate ASE Lønsikring)
    const saleIdsForContext = [...new Set(saleItems.map((si: any) => si.sale_id).filter(Boolean))] as string[];

    type SaleItemMeta = {
      id: string;
      sale_id: string;
      product_id: string | null;
      adversus_product_title: string | null;
      adversus_external_id: string | null;
    };

    const saleItemMetaById = new Map<string, SaleItemMeta>();
    const saleItemsBySaleId = new Map<string, SaleItemMeta[]>();

    if (saleIdsForContext.length > 0) {
      const saleIdChunkSize = 500;
      for (let i = 0; i < saleIdsForContext.length; i += saleIdChunkSize) {
        const chunk = saleIdsForContext.slice(i, i + saleIdChunkSize);
        const { data: siblings, error: siblingsError } = await supabase
          .from("sale_items")
          .select("id, sale_id, product_id, adversus_product_title, adversus_external_id")
          .in("sale_id", chunk);

        if (siblingsError) {
          console.error("[rematch-pricing-rules] Error fetching sibling sale_items:", siblingsError);
        }

        for (const si of (siblings || []) as SaleItemMeta[]) {
          saleItemMetaById.set(si.id, si);
          const existing = saleItemsBySaleId.get(si.sale_id) || [];
          existing.push(si);
          saleItemsBySaleId.set(si.sale_id, existing);
        }
      }
    }

    // Fetch all active pricing rules (include effective dates and immediate payment rates)
    const { data: pricingRules, error: rulesError } = await supabase
      .from("product_pricing_rules")
      .select("id, product_id, name, conditions, commission_dkk, revenue_dkk, priority, is_active, campaign_mapping_ids, allows_immediate_payment, effective_from, effective_to, immediate_payment_commission_dkk, immediate_payment_revenue_dkk, use_rule_name_as_display")
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
    const campaignIds = [...new Set(saleItems.map((si: any) => (si.sales as any)?.dialer_campaign_id).filter(Boolean))];
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
    const updates: { id: string; product_id: string; matched_pricing_rule_id: string | null; mapped_commission: number; mapped_revenue: number; needs_mapping: boolean; display_name: string | null }[] = [];
    let matchedCount = 0;
    let noMatchCount = 0;
    let productCorrectedCount = 0;
    let baseProductFallbackCount = 0;
    const matchDetails: { saleItemId: string; productId: string; originalProductId: string; ruleName: string; commission: number; revenue: number }[] = [];
    const deleteIds: string[] = [];

    for (const item of saleItems) {
      // Extract raw_payload.data
      const sale = normalizeJoinedSale(item.sales);
      const rawPayload = (item.sales as any)?.raw_payload as Record<string, unknown> | null;
      let rawPayloadData = rawPayload?.data as Record<string, unknown> | undefined;

      // Merge leadResultFields and leadResultData into rawPayloadData
      // This ensures Relatel sales with Tilskud in leadResultFields can match pricing rules
      const leadResultFields = rawPayload?.leadResultFields as Record<string, unknown> | undefined;
      const leadResultData = rawPayload?.leadResultData as Record<string, unknown> | undefined;

      if (leadResultFields && typeof leadResultFields === "object") {
        if (!rawPayloadData) rawPayloadData = {};
        for (const [key, value] of Object.entries(leadResultFields)) {
          if (value !== null && value !== undefined && value !== "") {
            rawPayloadData[key] = value;
          }
        }
      }
      if (leadResultData && typeof leadResultData === "object") {
        if (!rawPayloadData) rawPayloadData = {};
        for (const [key, value] of Object.entries(leadResultData)) {
          if (value !== null && value !== undefined && value !== "") {
            rawPayloadData[key] = value;
          }
        }
      }

      // Data enrichment: Add default Dækningssum for ASE sales if missing
      // This ensures pricing rules with Dækningssum conditions can match
      if (rawPayloadData) {
        const dækningssum = rawPayloadData['Dækningssum'] as string | undefined;
        const forening = rawPayloadData['Forening'] as string | undefined;
        const akasseSalg = rawPayloadData['A-kasse salg'] as string | undefined;
        
        // Only enrich if Dækningssum is missing and it's an A-kasse sale
        if (!dækningssum && akasseSalg === 'Ja') {
          // If "Fagforening med lønsikring" -> they have insurance -> assume over 6000
          // Otherwise (Ase Lønmodtager or missing) -> no insurance -> set to 0 (under 6000)
          if (forening === 'Fagforening med lønsikring') {
            rawPayloadData['Dækningssum'] = '6000';  // Over 6000 -> 800/1400 kr rules
            console.log(`[rematch-pricing-rules] Enriched Dækningssum=6000 for lønsikring sale`);
          } else {
            rawPayloadData['Dækningssum'] = '0';  // Under 6000 -> 600/1200 kr rules
            console.log(`[rematch-pricing-rules] Enriched Dækningssum=0 for non-lønsikring sale`);
          }
        }
      }

      // Determine correct product ID for ASE sales based on lead data
      const isAse = source === "ase" || (item.sales as any)?.source === "ase";

      // Normalize raw_payload keys for ASE sales (historical records may have lowercase keys)
      if (isAse && rawPayloadData) {
        rawPayloadData = normalizeRawPayloadKeys(rawPayloadData);
      }

      const originalProductId = item.product_id;

      const meta = saleItemMetaById.get(item.id);
      const siblings = saleItemsBySaleId.get(item.sale_id) || [];
      const hasOtherExplicitLoensikringInSale = siblings.some(
        (sib) => sib.id !== item.id && !!sib.adversus_product_title && /lønsikring/i.test(sib.adversus_product_title)
      );

      const isGhostItem = isAse && !meta?.adversus_product_title && !meta?.adversus_external_id;

      // If the sale already contains an explicit Lønsikring item, a ghost row must be treated as a duplicate
      // (otherwise it can create double Lønsikring commission).
      if (isGhostItem && hasOtherExplicitLoensikringInSale) {
        deleteIds.push(item.id);
        console.log(
          `[rematch-pricing-rules] Marking ghost ASE item ${item.id} for deletion (duplicate Lønsikring) on sale ${item.sale_id}`
        );
        continue;
      }

      const correctProductId = isAse
        ? determineAseProductId(
            rawPayloadData,
            originalProductId,
            (item as any).adversus_product_title,
            hasOtherExplicitLoensikringInSale
          )
        : originalProductId;
      const productWasCorrected = correctProductId !== originalProductId;
      if (productWasCorrected) {
        productCorrectedCount++;
        console.log(`[rematch-pricing-rules] Product corrected for item ${item.id}: ${originalProductId} → ${correctProductId}`);
      }

      // Get campaign mapping ID
      const campaignId = (item.sales as any)?.dialer_campaign_id;
      const campaignMappingId = campaignId ? campaignMappingsMap.get(campaignId) : null;

      // Get sale date for date-based rule filtering
      const saleDate = sale?.sale_datetime || null;

      // Try to match a pricing rule with the correct product ID and sale date
      const matchedRule = matchPricingRule(correctProductId, pricingRulesMap, rawPayloadData, campaignMappingId, saleDate);

      if (matchedRule) {
        const qty = item.quantity || 1;
        const isImmediatePayment = (item as { is_immediate_payment?: boolean }).is_immediate_payment === true;
        
        let commission: number;
        let revenue: number;
        
        if (isImmediatePayment && matchedRule.allowsImmediatePayment) {
          // User has enabled immediate payment - use elevated rates
          commission = (matchedRule.immediatePaymentCommission ?? matchedRule.commission) * qty;
          revenue = (matchedRule.immediatePaymentRevenue ?? matchedRule.revenue) * qty;
        } else {
          // Standard rates
          commission = matchedRule.commission * qty;
          revenue = matchedRule.revenue * qty;
        }

        // Determine display name: if immediate payment, check for rule name override
        // Otherwise use the standard display name from rule
        const displayName = matchedRule.displayName;

        updates.push({
          id: item.id,
          product_id: correctProductId,
          matched_pricing_rule_id: matchedRule.ruleId,
          mapped_commission: commission,
          mapped_revenue: revenue,
          needs_mapping: false,
          display_name: displayName,
          // NOTE: Do NOT include is_immediate_payment - preserve user's choice
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
            display_name: null, // No rule = no display name override
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
            display_name: null,
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

    // Delete ghost ASE items if any (prevents double Lønsikring commission on the same sale)
    if (deleteIds.length > 0) {
      if (dryRun) {
        console.log(`[rematch-pricing-rules] DRY RUN - Would delete ${deleteIds.length} ghost ASE sale_items`);
      } else {
        console.log(`[rematch-pricing-rules] Deleting ${deleteIds.length} ghost ASE sale_items...`);

        const deleteChunkSize = 200;
        for (let i = 0; i < deleteIds.length; i += deleteChunkSize) {
          const chunk = deleteIds.slice(i, i + deleteChunkSize);
          const { error: deleteError } = await supabase.from("sale_items").delete().in("id", chunk);
          if (deleteError) {
            console.error("[rematch-pricing-rules] Error deleting ghost sale_items:", deleteError);
          }
        }
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
              display_name: update.display_name,
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
