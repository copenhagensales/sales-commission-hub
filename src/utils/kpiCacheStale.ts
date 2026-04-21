/**
 * Shared staleness threshold for KPI / leaderboard cache reads.
 * If a cached row is older than this, callers should fall back to a live query
 * to avoid silently displaying outdated numbers when the background
 * calculation jobs are failing.
 */
export const KPI_CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export function isKpiCacheStale(calculatedAt: string | null | undefined): boolean {
  if (!calculatedAt) return true;
  const ts = new Date(calculatedAt).getTime();
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > KPI_CACHE_MAX_AGE_MS;
}

export function logStaleCacheWarning(source: string, calculatedAt: string | null | undefined) {
  const ageMs = calculatedAt ? Date.now() - new Date(calculatedAt).getTime() : Infinity;
  const ageHours = Number.isFinite(ageMs) ? (ageMs / 3_600_000).toFixed(1) : "∞";
  console.warn(
    `[${source}] KPI cache is stale (age: ${ageHours}h, threshold: ${KPI_CACHE_MAX_AGE_MS / 3_600_000}h). Returning empty result – callers should fall back to live query.`
  );
}
