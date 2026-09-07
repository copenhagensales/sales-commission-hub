/**
 * Ansættelsesperiode og anciennitet til deaktiveringsmails.
 * Ren formatering — læser ingen data og ændrer intet.
 */

function formatDanishDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Varighed mellem to datoer i dansk tekst:
 * under 1 måned → "13 dage", 1-12 måneder → "4 måneder",
 * over 1 år → "1 år og 3 måneder".
 */
export function formatTenure(
  startDate: string | null | undefined,
  endDate?: string | null,
): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  if (end < start) return "0 dage";

  const days = Math.floor((end.getTime() - start.getTime()) / 86_400_000);

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  if (months < 0) months = 0;

  if (months < 1) return `${days} dag${days === 1 ? "" : "e"}`;
  if (months < 12) return `${months} måned${months === 1 ? "" : "er"}`;

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  const yearText = `${years} år`;
  if (restMonths === 0) return yearText;
  return `${yearText} og ${restMonths} måned${restMonths === 1 ? "" : "er"}`;
}

/**
 * Hele linjen til mailen, fx
 * "25. august 2026 - 7. september 2026 (13 dage)".
 * Slutdato: registreret ophørsdato, ellers dagen i dag.
 */
export function formatEmploymentPeriod(
  startDate: string | null | undefined,
  endDate?: string | null,
): string {
  if (!startDate) return "Ikke angivet";
  const tenure = formatTenure(startDate, endDate);
  const endLabel = endDate
    ? formatDanishDate(endDate)
    : new Date().toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" });
  const period = `${formatDanishDate(startDate)} - ${endLabel}`;
  return tenure ? `${period} (${tenure})` : period;
}
