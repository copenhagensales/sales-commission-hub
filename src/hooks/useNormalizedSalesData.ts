import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchByIds } from "@/utils/supabasePagination";

interface NormalizedSaleData {
  id: string;
  normalizedData: Record<string, unknown> | null;
  rawPayload: Record<string, unknown> | null;
  piiFields?: string[];
}

/**
 * Hook to fetch normalized sales data.
 * Falls back to raw_payload if normalized_data is not available.
 * 
 * @param saleIds - Array of sale IDs to fetch
 * @returns Query result with normalized data
 */
export function useNormalizedSalesData(saleIds: string[]) {
  return useQuery({
    queryKey: ["normalized-sales-data", saleIds],
    queryFn: async () => {
      if (saleIds.length === 0) return [];

      const data = await fetchByIds<any>(
        "sales",
        "id",
        saleIds,
        "id, normalized_data, raw_payload"
      );

      return (data || []).map((sale): NormalizedSaleData => ({
        id: sale.id,
        normalizedData: sale.normalized_data as Record<string, unknown> | null,
        rawPayload: sale.raw_payload as Record<string, unknown> | null,
      }));
    },
    enabled: saleIds.length > 0,
  });
}

/**
 * Get a normalized field value from sale data.
 * Prioritizes normalized_data, falls back to raw_payload paths.
 * 
 * @param saleData - The sale data object
 * @param fieldKey - The standard field key (e.g., "phone_number")
 * @param fallbackPaths - Optional raw_payload paths to check as fallback
 */
export function getNormalizedField(
  saleData: NormalizedSaleData,
  fieldKey: string,
  fallbackPaths?: string[]
): unknown {
  // First check normalized_data
  if (saleData.normalizedData && fieldKey in saleData.normalizedData) {
    return saleData.normalizedData[fieldKey];
  }

  // Fallback to raw_payload using provided paths
  if (saleData.rawPayload && fallbackPaths) {
    for (const path of fallbackPaths) {
      const value = getNestedValue(saleData.rawPayload, path);
      if (value !== undefined && value !== null) {
        return value;
      }
    }
  }

  return undefined;
}

/**
 * Get a nested value from an object using dot notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Hook to fetch field definitions for display purposes.
 * Useful for building dynamic UIs based on available fields.
 */
export function useFieldDefinitions() {
  return useQuery({
    queryKey: ["data-field-definitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_field_definitions")
        .select("*")
        .order("category")
        .order("display_name");

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Get display-friendly field label from field definitions.
 */
export function useFieldLabel(fieldKey: string): string | null {
  const { data: definitions } = useFieldDefinitions();
  const definition = definitions?.find((d) => d.field_key === fieldKey);
  return definition?.display_name || null;
}
