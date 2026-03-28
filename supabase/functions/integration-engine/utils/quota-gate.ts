/**
 * Global Provider Quota Gate
 * 
 * Checks the most recent rate_limit_remaining from integration_sync_runs.
 * If remaining=0 and reset time is in the future, skips ALL syncs for that provider.
 * This prevents wasting API calls and edge function time when quota is exhausted.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface QuotaStatus {
  exhausted: boolean;
  remaining: number | null;
  resetAt: string | null;
  provider: string;
}

/**
 * Check if a provider's API quota is exhausted by reading the most recent
 * rate_limit_remaining from integration_sync_runs.
 */
export async function checkProviderQuota(
  supabase: SupabaseClient,
  provider: string
): Promise<QuotaStatus> {
  // Get all active integrations for this provider
  const { data: integrations } = await supabase
    .from("dialer_integrations")
    .select("id")
    .eq("provider", provider)
    .eq("is_active", true);

  if (!integrations || integrations.length === 0) {
    return { exhausted: false, remaining: null, resetAt: null, provider };
  }

  const integrationIds = integrations.map((i: any) => i.id);

  // Get the most recent sync run with rate_limit_remaining data
  const { data: latestRun } = await supabase
    .from("integration_sync_runs")
    .select("rate_limit_remaining, rate_limit_reset, rate_limit_daily_limit, completed_at")
    .in("integration_id", integrationIds)
    .not("rate_limit_remaining", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun || latestRun.rate_limit_remaining === null) {
    return { exhausted: false, remaining: null, resetAt: null, provider };
  }

  const remaining = latestRun.rate_limit_remaining as number;
  const resetAt = latestRun.rate_limit_reset as string | null;

  // Quota exhausted if remaining=0 AND reset is in the future (or unknown)
  if (remaining <= 0) {
    if (resetAt) {
      const resetTime = new Date(resetAt);
      if (resetTime > new Date()) {
        return { exhausted: true, remaining, resetAt, provider };
      }
      // Reset time has passed – quota should be refreshed
      return { exhausted: false, remaining, resetAt, provider };
    }
    // No reset time known – assume exhausted for safety
    return { exhausted: true, remaining, resetAt: null, provider };
  }

  return { exhausted: false, remaining, resetAt, provider };
}

/**
 * Check quota for a specific integration by its ID.
 */
export async function checkIntegrationQuota(
  supabase: SupabaseClient,
  integrationId: string
): Promise<QuotaStatus> {
  const { data: integration } = await supabase
    .from("dialer_integrations")
    .select("provider")
    .eq("id", integrationId)
    .maybeSingle();

  if (!integration) {
    return { exhausted: false, remaining: null, resetAt: null, provider: "unknown" };
  }

  return checkProviderQuota(supabase, integration.provider);
}
