/**
 * Per-Integration Run Lock (Single-Flight)
 * 
 * Ensures only one sync run per integration can execute at a time.
 * Uses a DB-based lock with TTL (10 min) and automatic cleanup of expired locks.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { LogFn } from "./index.ts";

const LOCK_TTL_MS = 3 * 60 * 1000; // 3 minutes – short TTL prevents crashed syncs from blocking the next window

/**
 * Generate a unique run ID for traceability
 */
export function generateRunId(): string {
  return `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Try to acquire a per-integration run lock.
 * Returns true if lock acquired, false if already locked (skip run).
 */
export async function acquireRunLock(
  supabase: SupabaseClient,
  integrationId: string,
  runId: string,
  log: LogFn
): Promise<boolean> {
  // 1. Clean up expired locks
  await supabase
    .from("integration_run_locks")
    .delete()
    .lt("expires_at", new Date().toISOString());

  // 2. Try to insert lock (primary key conflict = already locked)
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

  const { error } = await supabase
    .from("integration_run_locks")
    .insert({
      integration_id: integrationId,
      locked_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      locked_by: runId,
    });

  if (error) {
    if (error.code === "23505") {
      // Unique constraint violation = lock already held
      log("WARN", `Run lock: integration ${integrationId} already locked, skipping (run_id=${runId})`);
      return false;
    }
    log("ERROR", `Run lock acquire error: ${error.message}`);
    return false;
  }

  log("INFO", `Run lock acquired: integration=${integrationId} run_id=${runId} expires=${expiresAt.toISOString()}`);
  return true;
}

/**
 * Release the per-integration run lock.
 */
export async function releaseRunLock(
  supabase: SupabaseClient,
  integrationId: string,
  runId: string,
  log: LogFn
): Promise<void> {
  const { error } = await supabase
    .from("integration_run_locks")
    .delete()
    .eq("integration_id", integrationId);

  if (error) {
    log("WARN", `Run lock release error for ${integrationId}: ${error.message}`);
  } else {
    log("INFO", `Run lock released: integration=${integrationId} run_id=${runId}`);
  }
}
