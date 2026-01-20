import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardSale, PricingRule } from "../types.ts"
import { chunk } from "../utils/batch.ts"

/**
 * List of email domains that should be excluded from syncing.
 * These are internal/partner accounts that shouldn't be visible to users.
 */
const EXCLUDED_EMAIL_DOMAINS = [
  "@relatel.dk",
  "@ps-marketing.dk",
  "@finansforbundet.dk",
  "@straightlineagency.dk",
  "@staightlineagency.dk",
  "@tele-part.dk",
  "@aogtil.dk",
  "@ase.dk",
];

function isExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return EXCLUDED_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}

/**
 * Match a pricing rule based on leadResultData conditions.
 * Returns the matching rule with highest priority, or null if no match.
 */
function matchPricingRule(
  productId: string,
  pricingRulesMap: Map<string, PricingRule[]>,
  leadResultData: Array<{ id?: number; label: string; value: string }>,
  campaignMappingId?: string | null,
  log?: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
): { commission: number; revenue: number; ruleId: string; ruleName: string } | null {
  const rules = pricingRulesMap.get(productId);
  if (!rules || rules.length === 0) return null;

  // Sort by priority descending (highest first)
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (!rule.is_active) continue;

    // Check campaign restriction if rule has campaign_mapping_ids
    if (rule.campaign_mapping_ids && rule.campaign_mapping_ids.length > 0) {
      if (!campaignMappingId || !rule.campaign_mapping_ids.includes(campaignMappingId)) {
        continue;
      }
    }

    // Check all conditions match
    const conditions = rule.conditions || {};
    let allConditionsMet = true;

    for (const [condKey, condValue] of Object.entries(conditions)) {
      // Find the matching field in leadResultData
      const leadField = leadResultData.find(f => f.label === condKey);
      if (!leadField || leadField.value !== condValue) {
        allConditionsMet = false;
        break;
      }
    }

    if (allConditionsMet) {
      // Rules match if all conditions are met (empty conditions = match)
      // Campaign restriction is already checked above (lines 47-51)
      const hasCampaignRestriction = rule.campaign_mapping_ids && rule.campaign_mapping_ids.length > 0;
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
        ruleName: rule.name
      };
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
  // Extract leadResultData from rawPayload
  const leadResultData = (sale.rawPayload?.leadResultData as Array<{ id?: number; label: string; value: string }>) || [];
  
  // Get campaign mapping ID for this sale
  const campaignMappingId = sale.campaignId ? campaignMappingsMap.get(sale.campaignId) : null;

  for (const p of sale.products) {
    let productId = productMapByExtId.get(p.externalId)
    if (!productId && p.name) {
      const prod = productMapByName.get(p.name.toLowerCase())
      if (prod) productId = prod.id
    }
    let commission = 0
    let revenue = 0
    let matchedRuleId: string | null = null
    const qty = p.quantity || 1

    if (productId) {
      // First: try to match a pricing rule based on leadResultData conditions
      const matchedRule = matchPricingRule(
        productId,
        pricingRulesMap,
        leadResultData,
        campaignMappingId,
        log
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
    .select("id, adversus_external_id, adversus_opp_number, customer_phone")
    .in("adversus_external_id", externalIds)
  const existingSalesMap = new Map(existingSales?.map((s) => [s.adversus_external_id, s]) || [])

  const leadIds = sales.map((s) => s.leadId).filter(Boolean) as string[]
  const webhookOppMap = new Map<string, string>()
  const webhookPhoneMap = new Map<string, string>()
  if (leadIds.length > 0) {
    const webhookDuplicateIds = leadIds.filter((lid) => !externalIdSet.has(lid))
    if (webhookDuplicateIds.length > 0) {
      const { data: webhookSales } = await supabase
        .from("sales")
        .select("id, adversus_external_id, external_reference, customer_phone")
        .in("adversus_external_id", webhookDuplicateIds)
        .eq("integration_type", "adversus")
      if (webhookSales && webhookSales.length > 0) {
        for (const ws of webhookSales) {
          if (ws.adversus_external_id) {
            if (ws.external_reference) webhookOppMap.set(ws.adversus_external_id, ws.external_reference)
            if (ws.customer_phone) webhookPhoneMap.set(ws.adversus_external_id, ws.customer_phone)
          }
        }
        log(
          "INFO",
          `Eliminando ${webhookSales.length} registros duplicados del webhook (preservando ${webhookOppMap.size} OPPs, ${webhookPhoneMap.size} teléfonos)...`
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
      let oppNumber = sale.externalReference || null
      if (!oppNumber && existingSale?.adversus_opp_number) oppNumber = existingSale.adversus_opp_number
      if (!oppNumber && sale.leadId && webhookOppMap.has(sale.leadId)) {
        oppNumber = webhookOppMap.get(sale.leadId)!
      }
      let customerPhone = sale.customerPhone || null
      if (!customerPhone && existingSale?.customer_phone) customerPhone = existingSale.customer_phone
      if (!customerPhone && sale.leadId && webhookPhoneMap.has(sale.leadId)) {
        customerPhone = webhookPhoneMap.get(sale.leadId)!
      }
      const saleData = {
        adversus_external_id: sale.externalId,
        sale_datetime: sale.saleDate,
        agent_name: sale.agentName || sale.agentEmail,
        agent_email: sale.agentEmail || null,
        customer_company: sale.customerName,
        customer_phone: customerPhone,
        adversus_opp_number: oppNumber,
        client_campaign_id: sale.clientCampaignId || null,
        dialer_campaign_id: sale.campaignId || null,
        source: sale.dialerName,
        integration_type: sale.integrationType,
        raw_payload: sale.rawPayload || null,
        updated_at: new Date().toISOString(),
      }
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
    if (existingSaleIds.length > 0) {
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
      const { error: itemsError } = await supabase.from("sale_items").insert(saleItemsToInsert)
      if (itemsError) throw itemsError
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    const errDetails = e instanceof Error && "details" in e ? (e as any).details : undefined
    log("ERROR", `Error en operaciones bulk: ${errMsg}`, { details: errDetails, hint: (e as any)?.hint })
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

  // Filter out sales from excluded email domains
  const filteredSales = dedupedSales.filter(s => !isExcludedEmail(s.agentEmail))
  const skippedByDomain = dedupedSales.length - filteredSales.length
  
  if (skippedByDomain > 0) {
    log("INFO", `Skipped ${skippedByDomain} sales from excluded email domains`)
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
  
  // Fetch products, product mappings, pricing rules, and campaign mappings in parallel
  const [productsResult, mappingsResult, pricingRulesResult, campaignMappingsResult] = await Promise.all([
    supabase.from("products").select("id, name, commission_dkk, revenue_dkk"),
    supabase.from("adversus_product_mappings").select("*"),
    supabase.from("product_pricing_rules").select("id, product_id, name, conditions, commission_dkk, revenue_dkk, priority, is_active, campaign_mapping_ids").eq("is_active", true),
    supabase.from("adversus_campaign_mappings").select("id, adversus_campaign_id")
  ]);

  const dbProducts = productsResult.data;
  const dbMappings = mappingsResult.data;
  const pricingRules = pricingRulesResult.data;
  const campaignMappings = campaignMappingsResult.data;

  const productMapByName = new Map(dbProducts?.map((p) => [p.name.toLowerCase(), p]))
  const productMapByExtId = new Map(dbMappings?.map((m) => [m.adversus_external_id, m.product_id]))
  
  // Build pricing rules map: product_id -> array of rules
  const pricingRulesMap = new Map<string, PricingRule[]>();
  if (pricingRules) {
    for (const rule of pricingRules) {
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
    for (const mapping of campaignMappings) {
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
