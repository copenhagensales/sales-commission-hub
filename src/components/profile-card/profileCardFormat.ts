/**
 * Formateringshjælpere til spillerprofil-kortet.
 * Alle tal med dansk tusindtalsseparator.
 */
import { formatDKK, formatNumber } from "@/lib/calculations/formatting";

const MONTHS_SHORT = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

export function kr(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${formatDKK(Math.round(value))} kr`;
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return formatNumber(value);
}

/** "12. maj 2026" */
export function formatDanishDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${d}. ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "15. jun – 14. jul 2026" ud fra lønperiodens startdato (den 15.) */
export function formatPayPeriod(startIso: string | null | undefined): string | null {
  if (!startIso) return null;
  const [y, m] = startIso.split("-").map(Number);
  if (!y || !m) return null;
  const endMonth = m === 12 ? 1 : m + 1;
  const endYear = m === 12 ? y + 1 : y;
  const startPart = `15. ${MONTHS_SHORT[m - 1]}${
    endYear !== y ? ` ${y}` : ""
  }`;
  return `${startPart} – 14. ${MONTHS_SHORT[endMonth - 1]} ${endYear}`;
}

/** "Uge 19, 2026" */
export function formatIsoWeek(
  week: number | null | undefined,
  year: number | null | undefined
): string | null {
  if (!week || !year) return null;
  return `Uge ${week}, ${year}`;
}

/** "12. maj – 4. jun 2026" */
export function formatDateSpan(
  fromIso: string | null | undefined,
  toIso: string | null | undefined
): string | null {
  const from = formatDanishDate(fromIso);
  const to = formatDanishDate(toIso);
  if (!from || !to) return from ?? to;
  if (from === to) return from;
  return `${from} – ${to}`;
}

/** "3 år i huset" / "8 mdr i huset" */
export function formatTenure(startIso: string | null | undefined): string | null {
  if (!startIso) return null;
  const start = new Date(`${startIso}T00:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  if (start > now) return "starter senere";
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return "ny i huset";
  if (months < 12) return `${months} mdr i huset`;
  const years = Math.floor(months / 12);
  return `${years} år i huset`;
}

export function getInitials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? "";
  const b = lastName.trim()[0] ?? "";
  return `${a}${b}`.toUpperCase() || "?";
}

/** Division 1 = Superligaen, ellers "n-1. Division" */
export function formatDivision(division: number | null | undefined): string {
  if (!division) return "—";
  return division === 1 ? "Superligaen" : `${division - 1}. Division`;
}
