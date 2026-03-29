import { supabase } from "@/integrations/supabase/client";

function getCaseInsensitive(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  return undefined;
}

/**
 * When upload_type is "both", classify a row as cancellation / basket_difference / correct_match.
 * For rows coming from match-errors (no product comparison data available),
 * we check cancellation markers and default to "cancellation" if no markers are found
 * (since unmatched rows are overwhelmingly cancellations).
 */
export async function classifyUploadType(
  uploadType: string,
  rowData: Record<string, unknown>,
  clientId: string,
  importId: string
): Promise<string> {
  if (uploadType !== "both") return uploadType;

  // Fetch the config for this import
  const { data: importRow } = await supabase
    .from("cancellation_imports")
    .select("config_id")
    .eq("id", importId)
    .single();

  let typeCol: string | null = null;
  let typeVals: string[] = [];

  if (importRow?.config_id) {
    const { data: config } = await supabase
      .from("cancellation_upload_configs")
      .select("type_detection_column, type_detection_values")
      .eq("id", importRow.config_id)
      .single();

    typeCol = config?.type_detection_column || null;
    typeVals = (config?.type_detection_values as string[]) || [];
  }

  // Check 1: Configured type_detection_column/values
  let isCancellation = false;
  if (typeCol && typeVals.length > 0) {
    const cellVal = String(getCaseInsensitive(rowData, typeCol) || "").trim().toLowerCase();
    isCancellation = typeVals.some(v => v.toLowerCase() === cellVal);
  }

  // Check 2: "Annulled Sales" fallback
  if (!isCancellation) {
    const annulledVal = String(getCaseInsensitive(rowData, "Annulled Sales") || "").trim();
    isCancellation = annulledVal !== "" && annulledVal !== "0";
  }

  // For manually located sales from match-errors, we default to "cancellation"
  // since we don't have the full product comparison context
  return isCancellation ? "cancellation" : "cancellation";
}
