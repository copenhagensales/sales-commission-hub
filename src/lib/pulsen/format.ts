/** Ren visningslogik for Pulsen (tider, tegngrænser, billedmål). */
import { differenceInMinutes, format, isSameDay, isSameYear, subDays } from "date-fns";
import { da } from "date-fns/locale";

export const PULSEN_MAX_CHARS = 2000;
export const PULSEN_COUNTER_FROM = 1800;
export const PULSEN_PAGE_SIZE = 20;
export const PULSEN_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PULSEN_IMAGE_MAX_SIDE = 2000;

/** "nu", "12 min", "3 t", "i går 14:05", derefter dato. */
export function pulsenRelativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const mins = differenceInMinutes(now, d);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins} min`;
  if (isSameDay(d, now)) return `${Math.floor(mins / 60)} t`;
  if (isSameDay(d, subDays(now, 1))) return `i går ${format(d, "HH:mm")}`;
  return isSameYear(d, now) ? format(d, "d. MMM", { locale: da }) : format(d, "d. MMM yyyy", { locale: da });
}

export function showCharCounter(length: number): boolean {
  return length >= PULSEN_COUNTER_FROM;
}

/** Skalerer så den længste side højst er maxSide; mindre billeder forstørres ikke. */
export function fitWithin(width: number, height: number, maxSide = PULSEN_IMAGE_MAX_SIDE) {
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const f = maxSide / longest;
  return { width: Math.round(width * f), height: Math.round(height * f) };
}

/** "Rasmus Hansen" -> "Rasmus H." */
export function shortName(first?: string | null, last?: string | null): string {
  const l = (last || "").trim();
  const f = (first || "").trim();
  if (!f && !l) return "Kollega";
  return l ? `${f} ${l.charAt(0).toUpperCase()}.` : f;
}
