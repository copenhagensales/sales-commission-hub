/**
 * On-track-beregning til månedsmål-boards.
 *
 * Isoleret fra `src/lib/calculations/*` (lønberegning, rød zone).
 * Bruger kun læsende hjælpefunktioner derfra.
 */

/** Indeks-tærskler i procent. Juster her, ikke i logikken. */
export const INDEKS_FORAN = 105;
export const INDEKS_ON_TRACK = 95;
export const INDEKS_EFTER = 85;

/** Helligdage (ISO YYYY-MM-DD) der ikke tælles som hverdage. Tom indtil videre. */
export const HELLIGDAGE: string[] = [];

export type ProgressStatus = "foran" | "on-track" | "efter" | "bagud" | "ukendt";

export interface BoardProgress {
  /** Forventet antal på nuværende tidspunkt i måneden. */
  forventet: number;
  /** Forventet i procent af målet (0-100). */
  forventetPct: number;
  /** Forventet minus faktisk. Positiv = bagud. */
  gab: number;
  /** Mål pr. hverdag. */
  dagspace: number;
  /** Faktisk i procent af forventet. Null når forventet er 0. */
  indeks: number | null;
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
 * Beregner indeks og status ift. hvor mange hverdage der er gået i måneden.
 * Dagen i dag tæller MED som fuld arbejdsdag, så baseline er
 * mål/arbejdsdage pr. hverdag.
 */
export function calcBoardProgress(mål: number, faktisk: number, dato: Date): BoardProgress {
  const monthStart = new Date(dato.getFullYear(), dato.getMonth(), 1);
  const monthEnd = new Date(dato.getFullYear(), dato.getMonth() + 1, 0);

  const arbejdsdageTotal = countHverdage(monthStart, monthEnd);

  // I dag tæller med som fuld arbejdsdag (er i dag weekend/helligdag,
  // tælles kun de forudgående hverdage, da countHverdage filtrerer den fra).
  const today = new Date(dato.getFullYear(), dato.getMonth(), dato.getDate());
  const arbejdsdageGaaet = countHverdage(monthStart, today);

  const forventet = arbejdsdageTotal > 0 ? mål * (arbejdsdageGaaet / arbejdsdageTotal) : 0;
  const gab = forventet - faktisk;
  const dagspace = arbejdsdageTotal > 0 ? mål / arbejdsdageTotal : 0;
  const indeks = forventet > 0 ? (faktisk / forventet) * 100 : null;

  const status: ProgressStatus =
    indeks === null
      ? "ukendt"
      : indeks >= INDEKS_FORAN
        ? "foran"
        : indeks >= INDEKS_ON_TRACK
          ? "on-track"
          : indeks >= INDEKS_EFTER
            ? "efter"
            : "bagud";

  return {
    forventet,
    forventetPct: mål > 0 ? (forventet / mål) * 100 : 0,
    gab,
    dagspace,
    indeks,
    arbejdsdageTotal,
    arbejdsdageGaaet,
    status,
  };
}

/** Tailwind-klasse til tekstfarve efter status. */
export function statusTextClass(status: ProgressStatus): string {
  switch (status) {
    case "foran":
      return "text-emerald-400";
    case "on-track":
      return "text-yellow-400";
    case "efter":
      return "text-orange-400";
    case "ukendt":
      return "text-slate-300";
    default:
      return "text-rose-400";
  }
}

/** Tailwind-klasse til fyldfarve efter status. */
export function statusFillClass(status: ProgressStatus): string {
  switch (status) {
    case "foran":
      return "bg-emerald-400";
    case "on-track":
      return "bg-yellow-400";
    case "efter":
      return "bg-orange-400";
    case "ukendt":
      return "bg-slate-600";
    default:
      return "bg-rose-400";
  }
}

