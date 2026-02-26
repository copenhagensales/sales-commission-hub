export async function retry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; baseMs?: number; factor?: number; label?: string } = {}
): Promise<T> {
  const { retries = 3, baseMs = 100, factor = 2 } = opts
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (e) {
      attempt++
      if (attempt > retries) throw e
      const wait = baseMs * Math.pow(factor, attempt - 1)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

/**
 * Preset retry configs for different operation types.
 * Use: retry(fn, RETRY_PRESETS.api)
 */
export const RETRY_PRESETS = {
  /** External API calls: 5 retries, 2s base, factor 2 (2s, 4s, 8s, 16s, 32s) */
  api: { retries: 5, baseMs: 2000, factor: 2 },
  /** Database upserts: 3 retries, 500ms base (500ms, 1s, 2s) */
  db: { retries: 3, baseMs: 500, factor: 2 },
  /** Credential decryption: 2 retries, 1s base (1s, 2s) */
  credentials: { retries: 2, baseMs: 1000, factor: 2 },
  /** Light/fast operations: 3 retries, 100ms base (default) */
  light: { retries: 3, baseMs: 100, factor: 2 },
} as const;
