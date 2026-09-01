/**
 * On-track-beregning til månedsmål-boards.
 *
 * Isoleret fra `src/lib/calculations/*` (lønberegning, rød zone).
 * Bruger kun læsende hjælpefunktioner derfra.
 */

/** Tærskler i "dagspace" (mål pr. hverdag). Juster her, ikke i logikken. */
export const ON_TRACK_DAGE = 1;
export const EFTER_DAGE = 2;

/** Helligdage (ISO YYYY-MM-DD) der ikke tælles som hverdage. Tom indtil videre. */
export const HELLIGDAGE: string[] = [];

export type ProgressStatus = "on-track" | "efter" | "bagud";

export interface BoardProgress {
  /** Forventet antal på nuværende tidspunkt i måneden. */
  forventet: number;
  /** Forventet i procent af målet (0-100). */
  forventetPct: number;
  /** Forventet minus faktisk. Positiv = bagud. */
  gab: number;
  /** Mål pr. hverdag. */
  dagspace: number;
  arbejdsdageTotal: number;
  arbejdsdageGaaet: number;
  status: ProgressStatus;
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Hverdage (man-fre) i perioden, ekskl. helligdage. Begge datoer inklusive. */
function countHverdage(start: Date, end: Date): number {
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  let count = 0;
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6 && !HELLIGDAGE.includes(isoDate(current))) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * Beregner om man er foran, på eller bag target ift. hvor mange hverdage
 * der er gået i måneden. Dagen i dag tæller IKKE med (kun helt overståede dage).
 */
export function calcBoardProgress(mål: number, faktisk: number, dato: Date): BoardProgress {
  const monthStart = new Date(dato.getFullYear(), dato.getMonth(), 1);
  const monthEnd = new Date(dato.getFullYear(), dato.getMonth() + 1, 0);

  const arbejdsdageTotal = countHverdage(monthStart, monthEnd);

  const dayBeforeToday = new Date(dato.getFullYear(), dato.getMonth(), dato.getDate() - 1);
  const arbejdsdageGaaet = dayBeforeToday < monthStart ? 0 : countHverdage(monthStart, dayBeforeToday);

  const forventet = arbejdsdageTotal > 0 ? mål * (arbejdsdageGaaet / arbejdsdageTotal) : 0;
  const gab = forventet - faktisk;
  const dagspace = arbejdsdageTotal > 0 ? mål / arbejdsdageTotal : 0;

  const status: ProgressStatus =
    gab <= ON_TRACK_DAGE * dagspace ? "on-track" : gab <= EFTER_DAGE * dagspace ? "efter" : "bagud";

  return {
    forventet,
    forventetPct: mål > 0 ? (forventet / mål) * 100 : 0,
    gab,
    dagspace,
    arbejdsdageTotal,
    arbejdsdageGaaet,
    status,
  };
}

/** Tailwind-klasse til tekstfarve efter status. */
export function statusTextClass(status: ProgressStatus): string {
  switch (status) {
    case "on-track":
      return "text-emerald-400";
    case "efter":
      return "text-amber-400";
    default:
      return "text-rose-400";
  }
}

/** Tailwind-klasse til fyldfarve efter status. */
export function statusFillClass(status: ProgressStatus): string {
  switch (status) {
    case "on-track":
      return "bg-emerald-400";
    case "efter":
      return "bg-amber-400";
    default:
      return "bg-rose-400";
  }
}
