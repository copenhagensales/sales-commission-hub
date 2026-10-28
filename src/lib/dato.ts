import { todayInCopenhagen } from "./qualityDates";

/** Relativ dag for en dato (YYYY-MM-DD…) målt mod dansk »i dag«. Fortid tæller som »i dag«. */
export function relativDag(eventDate: string): "i dag" | "i morgen" | { dage: number } {
  const til = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const dage = Math.round((til(eventDate.slice(0, 10)) - til(todayInCopenhagen())) / 86_400_000);
  if (dage <= 0) return "i dag";
  if (dage === 1) return "i morgen";
  return { dage };
}
