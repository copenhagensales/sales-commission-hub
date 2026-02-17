/**
 * Sync State CRUD Helpers
 * 
 * Manages incremental sync watermarks in the dialer_sync_state table.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SyncState {
  last_success_at: string | null;
  cursor: string | null;
  last_error_at: string | null;
  last_error: string | null;
}

/**
 * Get the current sync state for an integration dataset.
 */
export async function getSyncState(
  supabase: SupabaseClient,
  integrationId: string,
  dataset: string
): Promise<SyncState | null> {
  const { data, error } = await supabase
    .from("dialer_sync_state")
    .select("last_success_at, cursor, last_error_at, last_error")
    .eq("integration_id", integrationId)
    .eq("dataset", dataset)
    .maybeSingle();

  if (error) {
    console.error(`[SyncState] Error reading state for ${dataset}:`, error.message);
    return null;
  }

  return data || null;
}

/**
 * Upsert sync state after successful sync.
 */
export async function upsertSyncState(
  supabase: SupabaseClient,
  integrationId: string,
  dataset: string,
  lastSuccessAt: Date | string,
  cursor?: string | null
): Promise<void> {
  const { error } = await supabase
    .from("dialer_sync_state")
    .upsert(
      {
        integration_id: integrationId,
        dataset,
        last_success_at: typeof lastSuccessAt === "string" ? lastSuccessAt : lastSuccessAt.toISOString(),
        cursor: cursor || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id,dataset" }
    );

  if (error) {
    console.error(`[SyncState] Error upserting state for ${dataset}:`, error.message);
  }
}

/**
 * Record a sync error for an integration dataset.
 */
export async function recordSyncError(
  supabase: SupabaseClient,
  integrationId: string,
  dataset: string,
  errorMsg: string
): Promise<void> {
  const { error } = await supabase
    .from("dialer_sync_state")
    .upsert(
      {
        integration_id: integrationId,
        dataset,
        last_error_at: new Date().toISOString(),
        last_error: errorMsg.substring(0, 1000), // Truncate long errors
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id,dataset" }
    );

  if (error) {
    console.error(`[SyncState] Error recording error for ${dataset}:`, error.message);
  }
}
