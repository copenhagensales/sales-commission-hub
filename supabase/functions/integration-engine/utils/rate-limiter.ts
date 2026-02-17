/**
 * Sliding Window Rate Limiter
 * 
 * Controls request rate per integration to stay within API limits.
 * Default: 55 req/min (buffer under Adversus 60/min), 900 req/hr (buffer under 1000/hr).
 */

export class RateLimiter {
  private timestamps: number[] = [];
  private maxPerMinute: number;
  private maxPerHour: number;

  constructor(maxPerMinute = 55, maxPerHour = 900) {
    this.maxPerMinute = maxPerMinute;
    this.maxPerHour = maxPerHour;
  }

  /**
   * Wait until a request slot is available.
   * Returns immediately if under limits, otherwise sleeps.
   */
  async waitForSlot(): Promise<void> {
    const now = Date.now();

    // Clean old timestamps (older than 1 hour)
    this.timestamps = this.timestamps.filter(t => now - t < 3600_000);

    // Check per-minute limit
    const oneMinuteAgo = now - 60_000;
    const recentMinute = this.timestamps.filter(t => t > oneMinuteAgo).length;

    if (recentMinute >= this.maxPerMinute) {
      const oldestInMinute = this.timestamps.filter(t => t > oneMinuteAgo).sort()[0];
      const waitMs = oldestInMinute + 60_000 - now + this.jitter();
      console.log(`[RateLimiter] Per-minute limit reached (${recentMinute}/${this.maxPerMinute}), waiting ${waitMs}ms`);
      await this.sleep(waitMs);
    }

    // Check per-hour limit
    const recentHour = this.timestamps.length;
    if (recentHour >= this.maxPerHour) {
      const oldestInHour = this.timestamps.sort()[0];
      const waitMs = oldestInHour + 3600_000 - Date.now() + this.jitter();
      console.log(`[RateLimiter] Per-hour limit reached (${recentHour}/${this.maxPerHour}), waiting ${waitMs}ms`);
      await this.sleep(waitMs);
    }

    this.timestamps.push(Date.now());
  }

  /**
   * Handle a 429 response with exponential backoff.
   * Honors Retry-After header if present.
   */
  async handle429(retryAfterHeader?: string | null, attempt = 1): Promise<void> {
    let waitMs: number;

    if (retryAfterHeader) {
      const retryAfterSec = parseInt(retryAfterHeader, 10);
      waitMs = (isNaN(retryAfterSec) ? 2000 : retryAfterSec * 1000) + this.jitter();
    } else {
      // Exponential backoff: 2s, 4s, 8s, 16s...
      waitMs = Math.min(2000 * Math.pow(2, attempt - 1), 30_000) + this.jitter();
    }

    console.log(`[RateLimiter] 429 received, waiting ${waitMs}ms (attempt ${attempt})`);
    await this.sleep(waitMs);
  }

  private jitter(): number {
    return Math.floor(Math.random() * 500);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  }
}
