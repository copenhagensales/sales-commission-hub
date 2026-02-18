/**
 * Fetch performance logging utility.
 * Tracks latency of critical data paths for observability.
 * 
 * Master plan: Fase 2 – Stram logging/metrics omkring fetch latency og fejlrate.
 */

interface FetchMetric {
  label: string;
  durationMs: number;
  rowCount?: number;
  timestamp: string;
  status: "ok" | "error";
  error?: string;
}

const SLOW_THRESHOLD_MS = 2000; // Log warning if >2s
const metrics: FetchMetric[] = [];
const MAX_METRICS = 100;

/**
 * Wrap an async fetch function with performance timing.
 * Logs slow queries and errors.
 * 
 * @example
 * const data = await trackFetch("dashboard-sales", async () => {
 *   const { data } = await supabase.from("sales").select("*");
 *   return data;
 * });
 */
export async function trackFetch<T>(
  label: string,
  fn: () => Promise<T>,
  options?: { warnThresholdMs?: number }
): Promise<T> {
  const start = performance.now();
  const threshold = options?.warnThresholdMs ?? SLOW_THRESHOLD_MS;

  try {
    const result = await fn();
    const durationMs = Math.round(performance.now() - start);

    const metric: FetchMetric = {
      label,
      durationMs,
      rowCount: Array.isArray(result) ? result.length : undefined,
      timestamp: new Date().toISOString(),
      status: "ok",
    };

    recordMetric(metric);

    if (durationMs > threshold) {
      console.warn(
        `[perf] SLOW fetch "${label}": ${durationMs}ms (threshold: ${threshold}ms)`,
        metric
      );
    }

    return result;
  } catch (error) {
    const durationMs = Math.round(performance.now() - start);
    const errorMsg = error instanceof Error ? error.message : String(error);

    recordMetric({
      label,
      durationMs,
      timestamp: new Date().toISOString(),
      status: "error",
      error: errorMsg,
    });

    console.error(`[perf] FAILED fetch "${label}": ${durationMs}ms`, errorMsg);
    throw error;
  }
}

function recordMetric(metric: FetchMetric) {
  metrics.push(metric);
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
}

/**
 * Get recent fetch metrics for debugging/observability.
 */
export function getRecentMetrics(): ReadonlyArray<FetchMetric> {
  return metrics;
}

/**
 * Get a summary of fetch performance (useful for dev tools / dashboards).
 */
export function getPerformanceSummary() {
  if (metrics.length === 0) return null;

  const okMetrics = metrics.filter((m) => m.status === "ok");
  const errorRate = metrics.filter((m) => m.status === "error").length / metrics.length;
  const durations = okMetrics.map((m) => m.durationMs).sort((a, b) => a - b);

  return {
    totalRequests: metrics.length,
    errorRate: Math.round(errorRate * 100) + "%",
    p50: durations[Math.floor(durations.length * 0.5)] ?? 0,
    p95: durations[Math.floor(durations.length * 0.95)] ?? 0,
    p99: durations[Math.floor(durations.length * 0.99)] ?? 0,
    slowest: durations[durations.length - 1] ?? 0,
  };
}
