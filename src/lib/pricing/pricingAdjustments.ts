/**
 * Prisjusteringer "til sidst" (pricing_adjustment_rules).
 *
 * Køres EFTER at satsen er valgt (prisregel eller grundpris). Konkurrerer
 * ikke med prisreglerne. Matchende justeringer anvendes i priority-orden
 * (højeste først) oven på hinanden.
 *
 * SPEJLET 1:1 i src/lib/pricing/pricingAdjustments.ts – test sammenligner filerne.
 */
import { evaluateTextCondition, type TextListCondition } from "./textCondition.ts";

export interface PricingAdjustmentRule {
  id: string;
  name: string;
  conditions: Record<string, string | TextListCondition>;
  excludedProductIds: string[];
  percentReduction: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  priority: number;
  /** Produkter (på reglens kunde) som reglen kan ramme. */
  productIds: Set<string>;
}

export interface AdjustmentInput {
  productId: string | null | undefined;
  saleDate: string | null | undefined;
  /** raw_payload fra salget (læser leadResultData, leadResultFields og data). */
  rawPayload: Record<string, unknown> | null | undefined;
  commission: number;
  revenue: number;
}

export interface AdjustmentResult {
  commission: number;
  revenue: number;
  ruleId: string | null;
}

/** Dato (YYYY-MM-DD) i dansk tid. */
export function copenhagenDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen" }).format(d);
}

/** Feltværdi pr. navn fra Adversus leadResultData/leadResultFields og Enreach data. */
export function readLeadField(rawPayload: Record<string, unknown> | null | undefined, field: string): string | undefined {
  if (!rawPayload) return undefined;
  const lrd = rawPayload.leadResultData;
  if (Array.isArray(lrd)) {
    for (const e of lrd) {
      if (e && typeof e === "object" && (e as { label?: unknown }).label === field) {
        const v = (e as { value?: unknown }).value;
        return v == null ? undefined : String(v);
      }
    }
  }
  for (const key of ["leadResultFields", "data"]) {
    const obj = rawPayload[key];
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const v = (obj as Record<string, unknown>)[field];
      if (v != null && v !== "") return String(v);
    }
  }
  return undefined;
}

function ruleMatches(rule: PricingAdjustmentRule, input: AdjustmentInput): boolean {
  if (!input.productId || !rule.productIds.has(input.productId)) return false;
  if (rule.excludedProductIds.includes(input.productId)) return false;
  if (rule.effectiveFrom || rule.effectiveTo) {
    if (!input.saleDate) return false;
    const d = copenhagenDate(input.saleDate);
    if (rule.effectiveFrom && d < rule.effectiveFrom) return false;
    if (rule.effectiveTo && d > rule.effectiveTo) return false;
  }
  const conds = Object.entries(rule.conditions || {});
  if (conds.length === 0) return false; // en justering uden betingelse må aldrig ramme alt
  for (const [field, cond] of conds) {
    if (!evaluateTextCondition(cond, readLeadField(input.rawPayload, field))) return false;
  }
  return true;
}

export function applyPricingAdjustments(rules: PricingAdjustmentRule[], input: AdjustmentInput): AdjustmentResult {
  let commission = input.commission;
  let revenue = input.revenue;
  let ruleId: string | null = null;
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (!ruleMatches(rule, input)) continue;
    const factor = 1 - rule.percentReduction / 100;
    commission = Math.round(commission * factor);
    revenue = Math.round(revenue * factor);
    ruleId = ruleId ?? rule.id;
  }
  return { commission, revenue, ruleId };
}

interface SupabaseLike {
  from: (table: string) => any;
}

/** Indlæser aktive justeringer + hvilke produkter de kan ramme. Fejl kastes (ingen stille 0-justering). */
export async function loadPricingAdjustments(supabase: SupabaseLike): Promise<PricingAdjustmentRule[]> {
  const { data: rows, error } = await supabase
    .from("pricing_adjustment_rules")
    .select("id, client_id, name, conditions, excluded_product_ids, percent_reduction, effective_from, effective_to, priority")
    .eq("is_active", true);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];
  const clientIds = [...new Set((rows as { client_id: string }[]).map((r) => r.client_id))];
  const { data: prods, error: pErr } = await supabase
    .from("products")
    .select("id, client_campaigns!inner(client_id)")
    .in("client_campaigns.client_id", clientIds);
  if (pErr) throw pErr;
  const byClient = new Map<string, Set<string>>();
  for (const p of (prods || []) as { id: string; client_campaigns: { client_id: string } | { client_id: string }[] }[]) {
    const cc = Array.isArray(p.client_campaigns) ? p.client_campaigns[0] : p.client_campaigns;
    if (!cc) continue;
    if (!byClient.has(cc.client_id)) byClient.set(cc.client_id, new Set());
    byClient.get(cc.client_id)!.add(p.id);
  }
  return (rows as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    conditions: r.conditions || {},
    excludedProductIds: r.excluded_product_ids || [],
    percentReduction: Number(r.percent_reduction),
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    priority: r.priority ?? 0,
    productIds: byClient.get(r.client_id) ?? new Set(),
  }));
}
