/**
 * Etablerede saelgere paa Opstart-siden: kun 1-1 og feedback, ingen salgsstatus.
 * Ren logik, saa daekning og sortering kan testes.
 */

export interface EstablishedAction {
  action_type: string;
  performed_at: string;
  note: string | null;
  focus_area?: string | null;
}

export interface EstablishedWeek {
  iso_year: number;
  iso_week: number;
}

export const COACHING = "1-1 samtale";
export const ABSENCE = "fravær hele ugen";

function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7) };
}

const key = (y: number, w: number) => `${y}-${w}`;

export type EstablishedWeekState = "held" | "none" | "absence";

/** De sidste op til 4 hele uger (den indevaerende uge er altid sidst i `weeks`). */
export function lastFullWeeks(
  weeks: EstablishedWeek[],
  actions: EstablishedAction[],
): { iso_year: number; iso_week: number; state: EstablishedWeekState }[] {
  const coached = new Set<string>();
  const absent = new Set<string>();
  for (const a of actions) {
    const { year, week } = isoWeekOf(new Date(a.performed_at));
    if (a.action_type === COACHING) coached.add(key(year, week));
    if (a.action_type === ABSENCE) absent.add(key(year, week));
  }
  return weeks.slice(0, -1).slice(-4).map((w) => {
    const k = key(w.iso_year, w.iso_week);
    return {
      iso_year: w.iso_year,
      iso_week: w.iso_week,
      state: coached.has(k) ? "held" : absent.has(k) ? "absence" : "none",
    };
  });
}

/** Daekning: uger med mindst én 1-1 ÷ saelger-uger, uger med fravaer udelades. */
export function coverage(rows: { state: EstablishedWeekState }[][]): { held: number; total: number; pct: number | null } {
  let held = 0;
  let total = 0;
  for (const r of rows)
    for (const w of r) {
      if (w.state === "absence") continue;
      total += 1;
      if (w.state === "held") held += 1;
    }
  return { held, total, pct: total > 0 ? Math.round((held / total) * 100) : null };
}

/** Seneste 1-1 (ms) eller null hvis aldrig. */
export function lastCoachingAt(actions: EstablishedAction[]): number | null {
  let best: number | null = null;
  for (const a of actions)
    if (a.action_type === COACHING) {
      const t = new Date(a.performed_at).getTime();
      if (best === null || t > best) best = t;
    }
  return best;
}

/** Laengst tid siden seneste 1-1 foerst; aldrig = oeverst. */
export function sortByLongestSince<T extends { employee_name: string; actions: EstablishedAction[] }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ta = lastCoachingAt(a.actions);
    const tb = lastCoachingAt(b.actions);
    if (ta !== tb) {
      if (ta === null) return -1;
      if (tb === null) return 1;
      return ta - tb;
    }
    return a.employee_name.localeCompare(b.employee_name, "da");
  });
}

/** "8 mdr." / "1 år" ud fra ansaettelsesdato. */
export function seniority(startDate: string | null | undefined, today = new Date()): string | null {
  if (!startDate) return null;
  const s = new Date(`${startDate}T00:00:00`);
  let months = (today.getFullYear() - s.getFullYear()) * 12 + (today.getMonth() - s.getMonth());
  if (today.getDate() < s.getDate()) months -= 1;
  if (months < 12) return `${Math.max(1, months)} mdr.`;
  const years = Math.floor(months / 12);
  return `${years} år`;
}

function mondayOf(d: Date): number {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x.getTime();
}

/** "I dag" / "1 uge siden" / "3 uger siden" (kalenderuger). */
export function weeksAgoLabel(iso: string, today = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === today.toDateString()) return "I dag";
  const weeks = Math.round((mondayOf(today) - mondayOf(d)) / (7 * 86400000));
  if (weeks <= 0) return "Denne uge";
  return weeks === 1 ? "1 uge siden" : `${weeks} uger siden`;
}
