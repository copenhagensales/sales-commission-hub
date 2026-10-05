import { supabase } from "@/integrations/supabase/client";

/**
 * Slår navne op på prisregler ud fra salgslinjernes `matched_pricing_rule_id`
 * (der er ingen FK, så det kan ikke indlejres i select). Ren læsning.
 */
export async function fetchPricingRuleNames(ids: (string | null | undefined)[]) {
  const unique = Array.from(new Set(ids.filter(Boolean) as string[]));
  const names = new Map<string, string>();
  for (let i = 0; i < unique.length; i += 200) {
    const { data, error } = await supabase
      .from("product_pricing_rules")
      .select("id, name")
      .in("id", unique.slice(i, i + 200));
    if (error) throw error;
    for (const r of data || []) if (r.name) names.set(r.id, r.name);
  }
  return names;
}
