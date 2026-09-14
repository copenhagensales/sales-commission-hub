/**
 * Datologik for kvalitetsmodulet.
 *
 * Standardvisning er dagens salg, og koen nulstiller derfor hver dag.
 * Vaelges en soendag manuelt, vises fredag, loerdag og soendag samlet,
 * saa weekendens salg ikke falder mellem to stole.
 */

/** Dagens dato i dansk tid som YYYY-MM-DD. */
export function todayInCopenhagen(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Ugedag: 0 = søndag, 1 = mandag. */
export function weekdayOf(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

/** Standarddatoen for kontrolkøen: i går. */
export function defaultQualityDate(): string {
  return addDays(todayInCopenhagen(), -1);
}

/**
 * De datoer der vises for en valgt dag. Er den valgte dag en søndag
 * (fordi i dag er mandag), vises fredag, lørdag og søndag.
 */
export function datesForQualityDay(isoDate: string): string[] {
  if (weekdayOf(isoDate) === 0) {
    return [addDays(isoDate, -2), addDays(isoDate, -1), isoDate];
  }
  return [isoDate];
}

export function formatDanishDate(isoDate: string): string {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function formatDanishTime(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
