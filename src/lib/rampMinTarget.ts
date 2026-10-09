export const DEFAULT_WEEKLY_MIN_TARGETS = [5, 8, 11, 14, 17];
const DAYS_PER_WEEK = 5;

/** Target for opstartsuge `week` (1-based). Last value applies to all later weeks. */
export function weeklyTarget(week: number, targets: number[]): number {
  const list = targets.length ? targets : DEFAULT_WEEKLY_MIN_TARGETS;
  return list[Math.min(Math.max(1, week), list.length) - 1];
}

/** Cumulative minimum sales after arbejdsdag `day` (1-based), spread evenly over 5 workdays per week. */
export function minCumulativeAt(day: number, targets: number[]): number {
  if (day <= 0) return 0;
  let total = 0;
  for (let d = 1; d <= Math.floor(day); d++) {
    total += weeklyTarget(Math.ceil(d / DAYS_PER_WEEK), targets) / DAYS_PER_WEEK;
  }
  return Math.round(total * 100) / 100;
}
