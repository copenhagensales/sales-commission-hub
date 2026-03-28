/**
 * Dead Letter Queue (DLQ)
 * 
 * Captures failed sync records for later reprocessing.
 * When a batch upsert fails, raw payloads are saved to sync_failed_records
 * so they can be retried or manually inspected.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function enqueueFailed(
  supabase: SupabaseClient,
  integrationId: string,
  dataset: string,
  records: unknown[],
  errorMessage: string,
  runId?: string
): Promise<void> {
  if (!records || records.length === 0) return;

  // Batch into chunks of 50 to avoid payload limits
  const chunkSize = 50;
  for (let i = 0; i < records.length; i += chunkSize) {
    const chunk = records.slice(i, i + chunkSize);
    try {
      await supabase.from("sync_failed_records").insert({
        integration_id: integrationId,
        dataset,
        raw_payload: chunk,
        error_message: errorMessage.substring(0, 1000),
        run_id: runId || null,
      });
    } catch (e) {
      // DLQ itself failed – log but don't crash the sync
      console.error(`[DLQ] Failed to enqueue ${chunk.length} ${dataset} records:`, e);
    }
  }
}

/**
 * Get count of unresolved failed records for an integration.
 */
export async function getUnresolvedCount(
  supabase: SupabaseClient,
  integrationId: string
): Promise<number> {
  const { count } = await supabase
    .from("sync_failed_records")
    .select("id", { count: "exact", head: true })
    .eq("integration_id", integrationId)
    .is("resolved_at", null);

  return count || 0;
}
