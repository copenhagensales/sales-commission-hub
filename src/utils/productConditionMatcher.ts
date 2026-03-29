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
 * For in/not_in matching: check if a cell value matches any of the
 * normalized condition values. Handles both exact matches and
 * substring token matching for legacy concatenated values.
 */
function valueMatchesAny(cellValue: string, vals: string[]): boolean {
  // Exact match
  if (vals.includes(cellValue)) return true;
  // Check if cellValue matches a space-separated token within a stored value
  // (handles legacy concatenated values like "5G Internet Ubegrænset data")
  for (const v of vals) {
    if (v.includes(" ")) {
      const tokens = v.split(/\s+/).filter(Boolean);
      if (tokens.includes(cellValue)) return true;
    }
  }
  return false;
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
        return valueMatchesAny(cellValue, vals);
      case "not_equals":
      case "not_in":
        return !valueMatchesAny(cellValue, vals);
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
  rowData: Record<string, unknown>
): string | null {
  for (const group of groupedConditions) {
    if (evaluateConditions(group.conditions, rowData)) {
      return group.product_id;
    }
  }
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
