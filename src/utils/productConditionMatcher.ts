/**
 * Shared utility for evaluating column-based product conditions
 * against a row of uploaded Excel data.
 */

export interface ProductCondition {
  column_name: string;
  operator: string; // 'any' | 'equals' | 'not_equals' | 'in' | 'not_in'
  values: string[];
}

export interface GroupedProductConditions {
  product_id: string;
  conditions: ProductCondition[];
}

/**
 * Case-insensitive key lookup on an object.
 */
function getCaseInsensitive(obj: Record<string, unknown>, key: string): unknown {
  const lower = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lower) return obj[k];
  }
  // Fuzzy: ignore hyphens, spaces, dots
  const normalize = (s: string) => s.toLowerCase().replace(/[-\s.]/g, "");
  const normKey = normalize(key);
  for (const k of Object.keys(obj)) {
    if (normalize(k) === normKey) return obj[k];
  }
  return undefined;
}

/**
 * Evaluate whether a single row matches ALL conditions for a product.
 */
/**
 * Normalize stored values: split concatenated strings that were
 * accidentally saved as a single array element into individual values.
 * E.g. ["A B C"] where A, B, C are known distinct values won't auto-split,
 * but we DO split each value by common delimiters when the array has only one
 * element and it looks like multiple values were concatenated.
 */
function normalizeConditionValues(rawValues: string[]): string[] {
  const result: string[] = [];
  for (const v of rawValues) {
    const trimmed = v.trim();
    if (!trimmed) continue;
    // If value contains a comma or semicolon, split on those
    if (trimmed.includes(",") || trimmed.includes(";")) {
      for (const part of trimmed.split(/[,;]/)) {
        const p = part.trim();
        if (p) result.push(p.toLowerCase());
      }
    } else {
      result.push(trimmed.toLowerCase());
    }
  }
  return result;
}


/**
 * Evaluate whether a single row matches ALL conditions for a product.
 */
export function evaluateConditions(
  conditions: ProductCondition[],
  rowData: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return false; // no conditions = no match

  return conditions.every((c) => {
    if (c.operator === "any") return true;

    const cellValue = String(getCaseInsensitive(rowData, c.column_name) ?? "")
      .trim()
      .toLowerCase();
    const vals = normalizeConditionValues(c.values);

    switch (c.operator) {
      case "equals":
      case "in":
        return vals.includes(cellValue);
      case "not_equals":
      case "not_in":
        return !vals.includes(cellValue);
      default:
        return true;
    }
  });
}

/**
 * Given grouped conditions for multiple products and a row of data,
 * find the first product_id whose conditions all match.
 * Returns null if no product matches.
 */
export function findMatchingProductId(
  groupedConditions: GroupedProductConditions[],
  rowData: Record<string, unknown>,
  debug = false
): string | null {
  for (const group of groupedConditions) {
    const match = evaluateConditions(group.conditions, rowData);
    if (debug) {
      console.log(`[ProductMatcher] product=${group.product_id} match=${match}`, {
        conditions: group.conditions.map(c => ({
          col: c.column_name,
          op: c.operator,
          vals: c.values,
          cellValue: String(rowData[c.column_name] ?? "").trim().toLowerCase(),
        })),
      });
    }
    if (match) {
      if (debug) console.log(`[ProductMatcher] ✅ Matched product: ${group.product_id}`);
      return group.product_id;
    }
  }
  if (debug) console.log(`[ProductMatcher] ❌ No product matched for row`, rowData);
  return null;
}

/**
 * Group flat condition rows (from DB) by product_id.
 */
export function groupConditionsByProduct(
  rows: { product_id: string; column_name: string; operator: string; values: string[] }[]
): GroupedProductConditions[] {
  const map = new Map<string, ProductCondition[]>();
  for (const row of rows) {
    const list = map.get(row.product_id) || [];
    list.push({
      column_name: row.column_name,
      operator: row.operator,
      values: row.values,
    });
    map.set(row.product_id, list);
  }
  return Array.from(map.entries()).map(([product_id, conditions]) => ({
    product_id,
    conditions,
  }));
}
