/**
 * Relative time helpers for the IT workstation module.
 * Single source of truth for "how long since" wording and staleness levels.
 */

export type StalenessLevel = "fresh" | "aging" | "stale" | "never";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / DAY_MS);
}

/** "i dag", "i går", "for 15 dage siden" — Danish, short and readable. */
export function formatSince(value: string | null | undefined): string {
  if (!value) return "aldrig";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "aldrig";

  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return "lige nu";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `for ${minutes} min. siden`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `for ${hours} ${hours === 1 ? "time" : "timer"} siden`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "i går";
  if (days < 31) return `for ${days} dage siden`;

  const months = Math.floor(days / 30);
  if (months < 12) return `for ${months} ${months === 1 ? "måned" : "måneder"} siden`;

  const years = Math.floor(days / 365);
  return `for ${years} ${years === 1 ? "år" : "år"} siden`;
}

/** Compact variant for tight card layouts: "15 d.", "3 t.", "aldrig". */
export function formatSinceShort(value: string | null | undefined): string {
  const days = daysSince(value);
  if (days === null) return "aldrig";
  if (days >= 1) return `${days} d.`;
  const hours = Math.floor((Date.now() - new Date(value as string).getTime()) / 3_600_000);
  if (hours >= 1) return `${hours} t.`;
  return "nu";
}

/**
 * Staleness buckets used for colouring.
 * fresh: under 14 dage · aging: 14-29 dage · stale: 30 dage eller mere.
 */
export function stalenessLevel(
  value: string | null | undefined,
  agingDays = 14,
  staleDays = 30,
): StalenessLevel {
  const days = daysSince(value);
  if (days === null) return "never";
  if (days >= staleDays) return "stale";
  if (days >= agingDays) return "aging";
  return "fresh";
}

export const STALENESS_TEXT_CLASS: Record<StalenessLevel, string> = {
  fresh: "text-muted-foreground",
  aging: "text-amber-600 dark:text-amber-400",
  stale: "text-destructive",
  never: "text-muted-foreground",
};
