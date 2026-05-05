import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardSale, PricingRule, NumericCondition } from "../types.ts"
import { chunk, fetchAllPaginated } from "../utils/batch.ts"
import { applyDataMappings, hasActiveMappings } from "./normalize.ts"

/**
 * Check if a condition value is a NumericCondition object
 */
function isNumericCondition(value: unknown): value is NumericCondition {
  return typeof value === 'object' && value !== null && 'operator' in value && 'value' in value;
}

/**
 * Evaluate a numeric condition against a lead field value
 */
function evaluateNumericCondition(condition: NumericCondition, leadValue: string | undefined): boolean {
  const numericLeadValue = parseFloat(leadValue || '0');
  if (isNaN(numericLeadValue)) return false;
  
  switch (condition.operator) {
    case 'gte': return numericLeadValue >= condition.value;
    case 'lte': return numericLeadValue <= condition.value;
    case 'gt': return numericLeadValue > condition.value;
    case 'lt': return numericLeadValue < condition.value;
    case 'between': return numericLeadValue >= condition.value && numericLeadValue <= (condition.value2 ?? condition.value);
    case 'in': return (condition.values ?? []).includes(numericLeadValue);
    default: return false;
  }
}

/**
 * List of VALID email domains that SHOULD be synced.
 * Only employees with these domains will have their data stored.
 */
const VALID_EMAIL_DOMAINS = [
  "@copenhagensales.dk",
  "@cph-relatel.dk",
  "@cph-sales.dk",
];

const WHITELISTED_EMAILS = [
  "kongtelling@gmail.com",
  "rasmusventura700@gmail.com",
];

// ============= ASE LØNSIKRING NORMALIZATION =============
// All Lønsikring variant product IDs that should be normalized to the standard one
// for correct pricing rule matching during sync (mirrors rematch-pricing-rules logic)
const ASE_LOENSIKRING_STANDARD_ID = "f9a8362f-3839-4247-961c-d5cd1e7cd37d";
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

/**
 * Normalize Lønsikring variant product IDs to the standard ID.
 * Also detects Lønsikring by product title if the ID doesn't match.
 */
function normalizeLoensikringProductId(
  productId: string | undefined | null,
  productTitle: string | undefined | null,
  log?: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
): string | undefined | null {
  if (productId && LOENSIKRING_VARIANT_IDS.has(productId)) {
    log?.("INFO", `Normalizing Lønsikring variant ${productId} → ${ASE_LOENSIKRING_STANDARD_ID}`);
    return ASE_LOENSIKRING_STANDARD_ID;
  }
  if (productId && productId !== ASE_LOENSIKRING_STANDARD_ID && productTitle && /lønsikring/i.test(productTitle)) {
    log?.("INFO", `Normalizing Lønsikring by title "${productTitle}" → ${ASE_LOENSIKRING_STANDARD_ID}`);
    return ASE_LOENSIKRING_STANDARD_ID;
  }
  return productId;
}

const EXCLUDED_EMAIL_PATTERNS = [
  /^agent-\d+@adversus\.local$/i,
];

function isValidSyncEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  
  if (WHITELISTED_EMAILS.includes(emailLower)) return true;
  
  if (EXCLUDED_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return false;
  }
  
  return VALID_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}

/**
 * Match a pricing rule based on leadResultData conditions and date validity.
 * Supports both Adversus format (leadResultData[]) and Enreach format (rawPayload.data{}).
 * Returns the matching rule with highest priority, or null if no match.
 */
function matchPricingRule(
  productId: string,
  pricingRulesMap: Map<string, PricingRule[]>,
  leadResultData: Array<{ id?: number; label: string; value: string }>,
  campaignMappingId?: string | null,
  log?: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void,
  rawPayloadData?: Record<string, unknown>, // Support for Enreach/HeroBase data format
  saleDate?: string | null // ISO date string for date-based filtering
): { commission: number; revenue: number; ruleId: string; ruleName: string; displayName: string | null } | null {
  const rules = pricingRulesMap.get(productId);
  if (!rules || rules.length === 0) return null;

  // Combine Adversus leadResultData with Enreach rawPayloadData into unified format
  const allFields: Array<{ label: string; value: string }> = [...leadResultData];
  
  // Convert Enreach rawPayload.data object to the same array format
  if (rawPayloadData && typeof rawPayloadData === 'object') {
    for (const [key, value] of Object.entries(rawPayloadData)) {
      // Skip internal fields and null/undefined values
      if (value !== null && value !== undefined && value !== '') {
        // Don't add duplicates if already in leadResultData
        if (!allFields.some(f => f.label === key)) {
          allFields.push({ label: key, value: String(value) });
        }
      }
    }
  }

  // Sort by priority descending (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  // Parse sale date for date-based filtering
  const saleDateObj = saleDate ? new Date(saleDate) : null;
  const saleDateStr = saleDateObj ? saleDateObj.toISOString().split('T')[0] : null;

  // Track if we have conditional rules but empty lead data
  const hasConditionalRules = sortedRules.some(r => r.is_active && Object.keys(r.conditions || {}).length > 0);
  const hasEmptyLeadData = allFields.length === 0;
  
  if (hasConditionalRules && hasEmptyLeadData) {
    log?.("WARN", `Product ${productId} has conditional pricing rules but leadResultData is empty - checking for campaign fallback`);
  }

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

    // Campaign restriction with include/exclude support
    // Mirrors logic in supabase/functions/_shared/pricing-service.ts and rematch-pricing-rules
    const ids = rule.campaign_mapping_ids;
    const hasRestriction = !!ids && ids.length > 0;
    const mode = (rule as any).campaign_match_mode === "exclude" ? "exclude" : "include";

    let campaignMatches: boolean;
    if (!hasRestriction) {
      campaignMatches = true; // universal rule
    } else if (mode === "include") {
      campaignMatches = !!campaignMappingId && ids!.includes(campaignMappingId);
    } else {
      // exclude: matches when sale's campaign is NOT in the list (or sale has no campaign)
      campaignMatches = !campaignMappingId || !ids!.includes(campaignMappingId);
    }
    if (!campaignMatches) {
      continue;
    }

    // Check all conditions match using unified allFields
    const conditions = rule.conditions || {};
    const conditionKeys = Object.keys(conditions);
    let allConditionsMet = true;
    let failedCondition: string | null = null;

    for (const [condKey, condValue] of Object.entries(conditions)) {
      // Find the matching field in allFields (combined Adversus + Enreach data)
      const leadField = allFields.find(f => f.label === condKey);
      
      if (isNumericCondition(condValue)) {
        // Numeric condition: evaluate using operator
        if (!evaluateNumericCondition(condValue, leadField?.value)) {
          allConditionsMet = false;
          failedCondition = `${condKey} ${condValue.operator} ${condValue.value}`;
          break;
        }
      } else {
        // String condition: exact match
        if (!leadField || leadField.value !== condValue) {
          allConditionsMet = false;
          failedCondition = condKey;
          break;
        }
      }
    }

    // NEW: Campaign fallback logic - if campaign matches AND leadResultData is empty,
    // use the rule anyway as a fallback (for campaigns that don't provide lead data)
    if (!allConditionsMet && conditionKeys.length > 0 && hasEmptyLeadData && campaignMatches) {
      log?.("INFO", `Using campaign fallback for rule "${rule.name}" - campaign matches but leadResultData is empty`, {
        ruleId: rule.id,
        productId,
        campaignMappingId,
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk
      });
      return {
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk,
        ruleId: rule.id,
        ruleName: rule.name,
        displayName: rule.use_rule_name_as_display ? rule.name : null
      };
    }

    if (allConditionsMet) {
      // Rules match if all conditions are met (empty conditions = match)
      log?.("INFO", `Matched pricing rule "${rule.name}" for product ${productId}`, {
        ruleId: rule.id,
        conditions,
        hasCampaignRestriction,
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk
      });
      return {
        commission: rule.commission_dkk,
        revenue: rule.revenue_dkk,
        ruleId: rule.id,
        ruleName: rule.name,
        displayName: rule.use_rule_name_as_display ? rule.name : null
      };
    } else if (conditionKeys.length > 0 && hasEmptyLeadData && !campaignMatches) {
      // Log when a conditional rule fails specifically due to empty lead data (and no campaign fallback)
      log?.("WARN", `Rule "${rule.name}" not matched - condition "${failedCondition}" could not be evaluated (empty leadResultData, no campaign fallback)`, {
        ruleId: rule.id,
        productId
      });
    }
  }

  return null;
}

async function ensureCampaignMappings(
  supabase: SupabaseClient,
  sales: StandardSale[],
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  const uniqueCampaigns = new Map<string, { id: string; name: string }>()
  for (const sale of sales) {
    if (sale.campaignId && !uniqueCampaigns.has(sale.campaignId)) {
      uniqueCampaigns.set(sale.campaignId, {
        id: sale.campaignId,
        name: sale.campaignName || sale.campaignId,
      })
    }
  }
  if (uniqueCampaigns.size === 0) return
  log("INFO", `Verificando ${uniqueCampaigns.size} campañas únicas...`)

  const campaignIds = Array.from(uniqueCampaigns.keys())
  const { data: existingMappings } = await supabase
    .from("adversus_campaign_mappings")
    .select("adversus_campaign_id")
    .in("adversus_campaign_id", campaignIds)

  const existingIds = new Set(existingMappings?.map((m) => m.adversus_campaign_id) || [])
  const newCampaigns = Array.from(uniqueCampaigns.values()).filter((c) => !existingIds.has(c.id))
  if (newCampaigns.length > 0) {
    log("INFO", `Creando ${newCampaigns.length} nuevos mapeos de campaña...`)
    const { error } = await supabase.from("adversus_campaign_mappings").insert(
      newCampaigns.map((c) => ({
        adversus_campaign_id: c.id,
        adversus_campaign_name: c.name,
      }))
    )
    if (error) {
      log("WARN", `Error creando mapeos de campaña: ${error.message}`)
    } else {
      log(
        "INFO",
        `Creados ${newCampaigns.length} mapeos de campaña: ${newCampaigns.map((c) => c.name).join(", ")}`
      )
    }
  }
}

function prepareSaleItems(
  sale: StandardSale,
  saleId: string,
  productMapByExtId: Map<string, string>,
  productMapByName: Map<string, any>,
  dbProducts: any[] | null,
  pricingRulesMap: Map<string, PricingRule[]>,
  campaignMappingsMap: Map<string, string>,
  itemsArray: any[],
  log?: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  // Extract leadResultData from rawPayload (Adversus format)
  const leadResultData = (sale.rawPayload?.leadResultData as Array<{ id?: number; label: string; value: string }>) || [];
  
  // Extract rawPayload.data (Enreach/HeroBase format) for pricing rule matching
  let rawPayloadData = sale.rawPayload?.data as Record<string, unknown> | undefined;
  
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
        log?.("INFO", `Enriched Dækningssum=6000 for lønsikring sale`);
      } else {
        rawPayloadData['Dækningssum'] = '0';  // Under 6000 -> 600/1200 kr rules
        log?.("INFO", `Enriched Dækningssum=0 for non-lønsikring sale`);
      }
    }
  }
  
  // Get campaign mapping ID for this sale
  const campaignMappingId = sale.campaignId ? campaignMappingsMap.get(sale.campaignId) : null;

  for (const p of sale.products) {
    // Multi-layer mapping lookup — single source of truth across all dialers/clients.
    // Some legacy mappings store the product TITLE in the adversus_external_id column
    // (instead of a numeric ID), so we must try multiple keys before giving up.
    let productId = productMapByExtId.get(p.externalId)
    // Fallback A: title stored as key in adversus_external_id column
    if (!productId && p.name) productId = productMapByExtId.get(p.name)
    // Fallback B: product with exact same name in products table
    if (!productId && p.name) {
      const prod = productMapByName.get(p.name.toLowerCase())
      if (prod) productId = prod.id
    }
    // Normalize Lønsikring variant IDs to the standard product ID for correct pricing rule matching
    productId = normalizeLoensikringProductId(productId, p.name, log) as string | undefined
    let commission = 0
    let revenue = 0
    let matchedRuleId: string | null = null
    const qty = p.quantity || 1
    let matchedRule: { commission: number; revenue: number; ruleId: string; ruleName: string; displayName: string | null } | null = null;

    if (productId) {
      // First: try to match a pricing rule based on leadResultData (Adversus) or rawPayload.data (Enreach)
      // Pass sale date for date-based rule filtering
      matchedRule = matchPricingRule(
        productId,
        pricingRulesMap,
        leadResultData,
        campaignMappingId,
        log,
        rawPayloadData,  // Pass Enreach data for condition matching
        sale.saleDate    // Pass sale date for date-based filtering
      );

      if (matchedRule) {
        commission = matchedRule.commission * qty;
        revenue = matchedRule.revenue * qty;
        matchedRuleId = matchedRule.ruleId;
      } else {
        // Fallback to base product pricing
        const fullProduct = dbProducts?.find((x) => x.id === productId)
        if (fullProduct) {
          commission = (fullProduct.commission_dkk || 0) * qty
          revenue = (fullProduct.revenue_dkk || 0) * qty
        }
      }
    }

    // Get display name from matched rule if configured
    const displayName = matchedRule?.displayName || null;

    itemsArray.push({
      sale_id: saleId,
      product_id: productId || null,
      adversus_external_id: p.externalId,
      adversus_product_title: p.name,
      quantity: qty,
      unit_price: p.unitPrice,
      mapped_commission: commission,
      mapped_revenue: revenue,
      needs_mapping: !productId,
      matched_pricing_rule_id: matchedRuleId,
      display_name: displayName,
    })
  }
}

async function processSalesBatch(
  supabase: SupabaseClient,
  sales: StandardSale[],
  productMapByName: Map<string, any>,
  productMapByExtId: Map<string, string>,
  dbProducts: any[] | null,
  pricingRulesMap: Map<string, PricingRule[]>,
  campaignMappingsMap: Map<string, string>,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  let processed = 0
  let errors = 0

  const externalIdsRaw = sales.map((s) => String(s.externalId || "").trim()).filter(Boolean)
  const externalIds = Array.from(new Set(externalIdsRaw))
  const externalIdSet = new Set(externalIds)

  const { data: existingSales } = await supabase
    .from("sales")
    .select("id, adversus_external_id, customer_phone, internal_reference")
    .in("adversus_external_id", externalIds)
  const existingSalesMap = new Map(existingSales?.map((s) => [s.adversus_external_id, s]) || [])

  const leadIds = sales.map((s) => s.leadId).filter(Boolean) as string[]
  const webhookPhoneMap = new Map<string, string>()
  if (leadIds.length > 0) {
    const webhookDuplicateIds = leadIds.filter((lid) => !externalIdSet.has(lid))
    if (webhookDuplicateIds.length > 0) {
      const { data: webhookSales } = await supabase
        .from("sales")
        .select("id, adversus_external_id, customer_phone")
        .in("adversus_external_id", webhookDuplicateIds)
        .eq("integration_type", "adversus")
      if (webhookSales && webhookSales.length > 0) {
        for (const ws of webhookSales) {
          if (ws.adversus_external_id) {
            if (ws.customer_phone) webhookPhoneMap.set(ws.adversus_external_id, ws.customer_phone)
          }
        }
        log(
          "INFO",
          `Eliminando ${webhookSales.length} registros duplicados del webhook (preservando ${webhookPhoneMap.size} teléfonos)...`
        )
        const webhookSaleIds = webhookSales.map((s) => s.id)
        await supabase.from("sale_items").delete().in("sale_id", webhookSaleIds)
        await supabase.from("sales").delete().in("id", webhookSaleIds)
      }
    }
  }

  const allSalesData: any[] = []
  const saleItemsToInsert: any[] = []
  const existingSaleIds: string[] = []

  for (const sale of sales) {
    try {
      const existingSale = existingSalesMap.get(sale.externalId)
      let customerPhone = sale.customerPhone || null
      if (!customerPhone && existingSale?.customer_phone) customerPhone = existingSale.customer_phone
      if (!customerPhone && sale.leadId && webhookPhoneMap.has(sale.leadId)) {
        customerPhone = webhookPhoneMap.get(sale.leadId)!
      }
      
      // Detect cancelled sales from raw_payload state (Adversus/Relatel)
      const rawPayload = sale.rawPayload as Record<string, unknown> | null | undefined
      const adversusState = rawPayload?.state as string | undefined
      const isCancelledSale = adversusState === 'cancelled'
      
      // Determine enrichment status based on provider data completeness
      let enrichmentStatus = 'complete'
      
      if (sale.integrationType === 'adversus') {
        const leadResultFields = rawPayload?.leadResultFields as Record<string, unknown> | undefined
        if (!leadResultFields || typeof leadResultFields !== 'object' || Object.keys(leadResultFields).length === 0) {
          enrichmentStatus = 'pending'
        }
      } else if (sale.integrationType === 'enreach') {
        const externalId = String(sale.externalId || '')
        if (externalId.startsWith('enreach-')) {
          enrichmentStatus = 'pending' // Webhook-created, needs enrichment
        } else {
          const payloadData = rawPayload?.data as Record<string, unknown> | undefined
          if (!payloadData || typeof payloadData !== 'object' || Object.keys(payloadData).length === 0) {
            enrichmentStatus = 'pending'
          }
        }
      }
      
      const saleData: Record<string, unknown> = {
        adversus_external_id: sale.externalId,
        sale_datetime: sale.saleDate,
        agent_name: sale.agentName || sale.agentEmail,
        agent_email: sale.agentEmail || null,
        customer_company: sale.customerName,
        customer_phone: customerPhone,
        client_campaign_id: sale.clientCampaignId || null,
        dialer_campaign_id: sale.campaignId || null,
        source: sale.dialerName,
        integration_type: sale.integrationType,
        raw_payload: sale.rawPayload || null,
        normalized_data: sale.normalizedData || null,
        updated_at: new Date().toISOString(),
        validation_status: 'pending',  // Eksplicit default for at undgå NULL
        enrichment_status: enrichmentStatus,
        enrichment_attempts: 0,
        enrichment_error: null,
      }
      
      // Set validation_status to cancelled if dialer reports cancelled state
      if (isCancelledSale) {
        saleData.validation_status = 'cancelled'
        log("INFO", `Sale ${sale.externalId} marked as cancelled from dialer state`)
      }
      
      // Lag 2: Bevar eksisterende internal_reference ved upsert
      const existingRef = existingSalesMap.get(sale.externalId)?.internal_reference;
      if (existingRef) saleData.internal_reference = existingRef;

      allSalesData.push(saleData)
      if (existingSale) existingSaleIds.push(existingSale.id)
      processed++
    } catch (e) {
      errors++
      const errMsg = e instanceof Error ? e.message : String(e)
      log("ERROR", `Error preparando venta ${sale.externalId}`, errMsg)
    }
  }

  try {
    // Preserve is_immediate_payment values for existing sale_items before deleting
    let preservedImmediatePaymentMap = new Map<string, { isImmediatePayment: boolean; commission: number; revenue: number; displayName: string | null }>()
    
    if (existingSaleIds.length > 0) {
      // First, fetch existing sale_items with is_immediate_payment = true
      const { data: existingItems } = await supabase
        .from("sale_items")
        .select("sale_id, product_id, is_immediate_payment, mapped_commission, mapped_revenue, display_name")
        .in("sale_id", existingSaleIds)
        .eq("is_immediate_payment", true)
      
      if (existingItems && existingItems.length > 0) {
        log("INFO", `Preserving ${existingItems.length} sale_items with is_immediate_payment=true`)
        for (const item of existingItems) {
          // Key by sale_id + product_id to match after reinsertion
          const key = `${item.sale_id}:${item.product_id}`
          preservedImmediatePaymentMap.set(key, {
            isImmediatePayment: item.is_immediate_payment,
            commission: item.mapped_commission,
            revenue: item.mapped_revenue,
            displayName: item.display_name
          })
        }
      }
      
      await supabase.from("sale_items").delete().in("sale_id", existingSaleIds)
    }
    if (allSalesData.length > 0) {
      const { data: upsertedSales, error: upsertError } = await supabase
        .from("sales")
        .upsert(allSalesData, {
          onConflict: "adversus_external_id",
          ignoreDuplicates: false,
        })
        .select("id, adversus_external_id")
      if (upsertError) throw upsertError
      const saleIdMap = new Map(upsertedSales?.map((s: any) => [s.adversus_external_id, s.id]) || [])
      for (const sale of sales) {
        const saleId = saleIdMap.get(sale.externalId)
        if (saleId) {
          prepareSaleItems(
            sale,
            saleId,
            productMapByExtId,
            productMapByName,
            dbProducts,
            pricingRulesMap,
            campaignMappingsMap,
            saleItemsToInsert,
            log
          )
        }
      }
    }
    if (saleItemsToInsert.length > 0) {
      // Restore is_immediate_payment for matching items
      for (const item of saleItemsToInsert) {
        const key = `${item.sale_id}:${item.product_id}`
        const preserved = preservedImmediatePaymentMap.get(key)
        if (preserved) {
          item.is_immediate_payment = preserved.isImmediatePayment
          item.mapped_commission = preserved.commission
          item.mapped_revenue = preserved.revenue
          item.display_name = preserved.displayName
          log("INFO", `Restored is_immediate_payment for sale_item ${item.sale_id}:${item.product_id}`)
        }
      }
      
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItemsToInsert)
      if (itemsError) throw itemsError
    }
  } catch (e) {
    const errMsg = (e as any)?.message || (e instanceof Error ? e.message : JSON.stringify(e))
    const errCode = (e as any)?.code
    const errDetails = (e as any)?.details
    const errHint = (e as any)?.hint
    log("ERROR", `Error en operaciones bulk: ${errMsg}`, { code: errCode, details: errDetails, hint: errHint })
    errors += sales.length
    processed = 0
  }

  return { processed, errors }
}

export async function processSales(
  supabase: SupabaseClient,
  sales: StandardSale[],
  batchSize: number,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  if (sales.length === 0) return { processed: 0, errors: 0 }

  // Normalizar + deduplicar por adversus_external_id para evitar errores de bulk upsert
  const byExternalId = new Map<string, StandardSale>()
  let duplicates = 0
  for (const s of sales) {
    const externalId = String(s.externalId || "").trim()
    if (!externalId) continue
    const normalized = { ...s, externalId }

    const prev = byExternalId.get(externalId)
    if (!prev) {
      byExternalId.set(externalId, normalized)
      continue
    }

    duplicates++
    // Preferir la venta con fecha más reciente (siempre que sea parseable)
    const prevTs = Date.parse(prev.saleDate)
    const nextTs = Date.parse(normalized.saleDate)
    if (!Number.isNaN(nextTs) && (Number.isNaN(prevTs) || nextTs > prevTs)) {
      byExternalId.set(externalId, normalized)
    }
  }

  const dedupedSales = Array.from(byExternalId.values())
  if (dedupedSales.length === 0) return { processed: 0, errors: 0 }

  // Filter out sales without valid sync email (whitelist approach)
  const filteredSales = dedupedSales.filter(s => isValidSyncEmail(s.agentEmail))
  const skippedByDomain = dedupedSales.length - filteredSales.length
  
  if (skippedByDomain > 0) {
    log("INFO", `Skipped ${skippedByDomain} sales from invalid/excluded email domains`)
  }
  
  if (filteredSales.length === 0) return { processed: 0, errors: 0, skipped: skippedByDomain }

  const sampleSale = filteredSales[0]
  log(
    "INFO",
    `Procesando ${filteredSales.length} ventas de ${sampleSale.dialerName} (${sampleSale.integrationType}) en lotes de ${batchSize}...`
  )
  if (duplicates > 0) {
    log("WARN", `Detectados ${duplicates} external_id duplicados (deduplicados antes de upsert).`)
  }

  await ensureCampaignMappings(supabase, filteredSales, log)
  
  // Fetch products, product mappings, pricing rules, campaign mappings, and check for active data mappings in parallel
  const [productsResult, mappingsResult, pricingRulesResult, campaignMappingsResult, integrationsResult] = await Promise.all([
    fetchAllPaginated(supabase, "products", "id, name, commission_dkk, revenue_dkk", (q) => q),
    fetchAllPaginated(supabase, "adversus_product_mappings", "*", (q) => q),
    fetchAllPaginated(supabase, "product_pricing_rules", "id, product_id, name, conditions, commission_dkk, revenue_dkk, priority, is_active, campaign_mapping_ids, campaign_match_mode, effective_from, effective_to, use_rule_name_as_display", (q) => q.eq("is_active", true)),
    fetchAllPaginated(supabase, "adversus_campaign_mappings", "id, adversus_campaign_id", (q) => q),
    supabase.from("dialer_integrations").select("id, name").eq("is_active", true)
  ]);

  const dbProducts = productsResult;
  const dbMappings = mappingsResult;
  const pricingRules = pricingRulesResult;
  const campaignMappings = campaignMappingsResult;
  const dialerIntegrations = integrationsResult.data || [];

  // Build integration lookup map by name for data mappings
  const integrationByName = new Map<string, string>();
  for (const int of dialerIntegrations) {
    integrationByName.set(int.name.toLowerCase(), int.id);
  }

  // Apply data mappings to sales if configured
  let normalizedCount = 0;
  for (const sale of filteredSales) {
    // Try to find integration ID by dialer name
    const integrationId = integrationByName.get(sale.dialerName.toLowerCase());
    if (integrationId) {
      try {
        // Check if this integration has active mappings configured
        const hasMappings = await hasActiveMappings(supabase, integrationId);
        if (hasMappings && sale.rawPayload) {
          const result = await applyDataMappings(supabase, integrationId, sale.rawPayload, log);
          if (Object.keys(result.normalizedData).length > 0) {
            sale.normalizedData = result.normalizedData;
            sale.piiFields = result.piiFields;
            normalizedCount++;
          }
        }
      } catch (err) {
        // Non-fatal: log and continue without normalization
        log("WARN", `Data mapping failed for sale ${sale.externalId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  
  if (normalizedCount > 0) {
    log("INFO", `Applied data mappings to ${normalizedCount} sales`);
  }

  const productMapByName = new Map(dbProducts?.map((p: any) => [p.name.toLowerCase(), p]))
  // Build productMapByExtId from BOTH adversus_external_id and adversus_product_title
  // — single source of truth that works regardless of how legacy mappings were keyed.
  const productMapByExtId = new Map<string, string>()
  for (const m of (dbMappings || []) as any[]) {
    if (!m.product_id) continue
    if (m.adversus_external_id) productMapByExtId.set(m.adversus_external_id, m.product_id)
    if (m.adversus_product_title) productMapByExtId.set(m.adversus_product_title, m.product_id)
  }
  
  // Build pricing rules map: product_id -> array of rules
  const pricingRulesMap = new Map<string, PricingRule[]>();
  if (pricingRules) {
    for (const rule of pricingRules as any[]) {
      const existing = pricingRulesMap.get(rule.product_id) || [];
      existing.push(rule as PricingRule);
      pricingRulesMap.set(rule.product_id, existing);
    }
    if (pricingRulesMap.size > 0) {
      log("INFO", `Loaded ${pricingRules.length} active pricing rules for ${pricingRulesMap.size} products`);
    }
  }

  // Build campaign mappings map: adversus_campaign_id -> mapping id
  const campaignMappingsMap = new Map<string, string>();
  if (campaignMappings) {
    for (const mapping of campaignMappings as any[]) {
      campaignMappingsMap.set(mapping.adversus_campaign_id, mapping.id);
    }
  }

  let totalProcessed = 0
  let totalErrors = 0
  const batches = chunk(filteredSales, batchSize)
  const totalBatches = batches.length
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batch = batches[batchNum]
    log("INFO", `Procesando lote ${batchNum + 1}/${totalBatches} (${batch.length} ventas)...`)
    const { processed, errors } = await processSalesBatch(
      supabase,
      batch,
      productMapByName,
      productMapByExtId,
      dbProducts,
      pricingRulesMap,
      campaignMappingsMap,
      log
    )
    totalProcessed += processed
    totalErrors += errors
    log(
      "INFO",
      `Lote ${batchNum + 1} completado: ${processed} procesadas, ${errors} errores. Total: ${totalProcessed}/${filteredSales.length}`
    )
  }
  return { processed: totalProcessed, errors: totalErrors }
}
