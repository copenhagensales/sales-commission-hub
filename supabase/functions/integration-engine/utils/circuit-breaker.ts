/**
 * Circuit Breaker for Integration Sync
 * 
 * Auto-pauses integrations after repeated consecutive failures (429 errors).
 * Prevents hammering a rate-limited API and wasting edge function resources.
 * 
 * Thresholds:
 * - 3 consecutive failures → pause 15 minutes
 * - 5 consecutive failures → pause 30 minutes
 * - 8+ consecutive failures → pause 60 minutes
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const PAUSE_SCHEDULE: { threshold: number; pauseMinutes: number }[] = [
  { threshold: 8, pauseMinutes: 60 },
  { threshold: 5, pauseMinutes: 30 },
  { threshold: 3, pauseMinutes: 15 },
];

export interface CircuitBreakerState {
  consecutiveFailures: number;
  pausedUntil: string | null;
  lastError: string | null;
}

/**
 * Check if integration is currently paused by circuit breaker.
 * Returns null if OK to proceed, or the pause-until timestamp if paused.
 */
export async function checkCircuitBreaker(
  supabase: SupabaseClient,
  integrationId: string
): Promise<{ paused: boolean; pausedUntil: string | null; consecutiveFailures: number }> {
  const { data } = await supabase
    .from("integration_circuit_breaker")
    .select("consecutive_failures, paused_until")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (!data) return { paused: false, pausedUntil: null, consecutiveFailures: 0 };

  if (data.paused_until && new Date(data.paused_until) > new Date()) {
    return {
      paused: true,
      pausedUntil: data.paused_until,
      consecutiveFailures: data.consecutive_failures,
    };
  }

  return { paused: false, pausedUntil: null, consecutiveFailures: data.consecutive_failures };
}

/**
 * Record a sync failure. Increments counter and sets pause if threshold is reached.
 */
export async function recordCircuitBreakerFailure(
  supabase: SupabaseClient,
  integrationId: string,
  errorMsg: string
): Promise<{ newCount: number; pausedMinutes: number | null }> {
  // Get current state
  const { data: current } = await supabase
    .from("integration_circuit_breaker")
    .select("consecutive_failures")
    .eq("integration_id", integrationId)
    .maybeSingle();

  const newCount = (current?.consecutive_failures || 0) + 1;

  // Determine pause duration
  let pauseMinutes: number | null = null;
  for (const level of PAUSE_SCHEDULE) {
    if (newCount >= level.threshold) {
      pauseMinutes = level.pauseMinutes;
      break;
    }
  }

  const pausedUntil = pauseMinutes
    ? new Date(Date.now() + pauseMinutes * 60 * 1000).toISOString()
    : null;

  await supabase
    .from("integration_circuit_breaker")
    .upsert(
      {
        integration_id: integrationId,
        consecutive_failures: newCount,
        last_failure_at: new Date().toISOString(),
        paused_until: pausedUntil,
        last_error: errorMsg.substring(0, 500),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id" }
    );

  return { newCount, pausedMinutes };
}

/**
 * Reset circuit breaker on successful sync.
 */
export async function resetCircuitBreaker(
  supabase: SupabaseClient,
  integrationId: string
): Promise<void> {
  await supabase
    .from("integration_circuit_breaker")
    .upsert(
      {
        integration_id: integrationId,
        consecutive_failures: 0,
        paused_until: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "integration_id" }
    );
}
