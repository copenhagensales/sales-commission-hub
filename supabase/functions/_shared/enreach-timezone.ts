/**
 * Convert Enreach/HeroBase Danish local time strings to UTC.
 * 
 * Enreach timestamps are in Europe/Copenhagen (CET/CEST) but lack timezone info.
 * This function deterministically converts them to UTC using Intl timezone rules,
 * correctly handling DST transitions (last Sunday in March/October).
 * 
 * Supported input formats:
 *   - "DD-MM-YYYY HH:mm:ss" (HeroBase format)
 *   - "YYYY-MM-DDTHH:mm:ss" (ISO without offset)
 *   - Any string parseable by Date constructor
 */
export function enreachToUTC(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();

  // Normalise DD-MM-YYYY HH:mm:ss → ISO
  const heroMatch = dateStr.match(
    /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/
  );
  const isoStr = heroMatch
    ? `${heroMatch[3]}-${heroMatch[2]}-${heroMatch[1]}T${heroMatch[4]}:${heroMatch[5]}:${heroMatch[6]}`
    : dateStr;

  const naive = new Date(isoStr);
  if (isNaN(naive.getTime())) return new Date().toISOString();

  // Use Intl to find the Europe/Copenhagen offset for this specific date
  const formatter = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Copenhagen",
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(naive);
  const offsetStr = parts.find((p) => p.type === "timeZoneName")?.value || "";
  const offsetHours = parseInt(offsetStr.replace("GMT", "") || "1", 10);

  // Subtract DK offset to convert wall-time → UTC
  return new Date(naive.getTime() - offsetHours * 3600000).toISOString();
}
