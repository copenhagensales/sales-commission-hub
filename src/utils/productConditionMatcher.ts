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
  return undefined;
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
    const vals = c.values.map((v) => v.toLowerCase().trim());

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
