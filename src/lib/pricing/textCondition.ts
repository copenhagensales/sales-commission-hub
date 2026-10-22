/**
 * Tekstbetingelser i prisregler (product_pricing_rules.conditions).
 *
 * Formater:
 *  - Gammelt/"=":  "Felt": "Værdi"                      → præcis lighed (uændret adfærd)
 *  - "en af":      "Felt": { operator: "in", values }     → salgets værdi er én af values
 *  - "ikke lig":   "Felt": { operator: "not_in", values } → feltet findes og værdien er ingen af values
 *
 * Holdes 1:1 med supabase/functions/_shared/textCondition.ts (test sammenligner dem).
 */
export interface TextListCondition {
  operator: "in" | "not_in";
  values: string[];
}

export function isTextListCondition(value: unknown): value is TextListCondition {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { operator?: unknown; values?: unknown; value?: unknown };
  return (
    (v.operator === "in" || v.operator === "not_in") &&
    !("value" in v) &&
    Array.isArray(v.values) &&
    v.values.every((x) => typeof x === "string")
  );
}

/** Returnerer true hvis salgets feltværdi opfylder tekstbetingelsen. */
export function evaluateTextCondition(
  condition: string | TextListCondition,
  leadValue: string | undefined | null,
): boolean {
  if (leadValue === undefined || leadValue === null) return false;
  if (typeof condition === "string") return leadValue === condition;
  if (condition.values.length === 0) return false;
  const hit = condition.values.includes(leadValue);
  return condition.operator === "in" ? hit : !hit;
}
