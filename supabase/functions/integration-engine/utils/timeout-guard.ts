/**
 * Timeout Guard
 * 
 * Tracks elapsed time during a sync run and signals when to stop gracefully
 * before the edge function hard timeout kills the process.
 * 
 * Default budget: 150s (edge function max). Stop at 80% = 120s.
 */

export class TimeoutGuard {
  private startTime: number;
  private budgetMs: number;
  private thresholdPercent: number;

  constructor(budgetMs: number = 150_000, thresholdPercent: number = 0.80) {
    this.startTime = Date.now();
    this.budgetMs = budgetMs;
    this.thresholdPercent = thresholdPercent;
  }

  /** Elapsed milliseconds since creation */
  elapsed(): number {
    return Date.now() - this.startTime;
  }

  /** Remaining milliseconds before threshold */
  remaining(): number {
    return Math.max(0, this.budgetMs * this.thresholdPercent - this.elapsed());
  }

  /** True if we've exceeded the safe threshold */
  isExpired(): boolean {
    return this.elapsed() >= this.budgetMs * this.thresholdPercent;
  }

  /** Percent of budget used (0-100) */
  percentUsed(): number {
    return Math.min(100, (this.elapsed() / this.budgetMs) * 100);
  }
}
