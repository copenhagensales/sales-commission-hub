/**
 * Copenhagen-aware helpers for league round windows.
 *
 * Rounds are stored as UTC timestamps that represent Copenhagen wall-clock
 * boundaries: Monday 00:00 CPH -> Sunday <round_end_hour>:<round_end_minute>:59 CPH.
 * DST is handled via Intl, so no hardcoded +1/+2 offsets.
 */

const CPH_TZ = "Europe/Copenhagen";

function tzOffsetMs(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: CPH_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

/** Copenhagen calendar date parts for a UTC instant. */
export function cphDateParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + tzOffsetMs(date));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Converts a Copenhagen wall-clock time to the matching UTC instant. */
export function cphToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const firstGuess = new Date(naive - tzOffsetMs(new Date(naive)));
  const offset = tzOffsetMs(firstGuess);
  return new Date(naive - offset);
}

/** Monday 00:00 CPH for a `YYYY-MM-DD` season/round start date. */
export function roundStartFromDateString(dateString: string): Date {
  const [y, m, d] = dateString.slice(0, 10).split("-").map(Number);
  return cphToUtc(y, m, d, 0, 0, 0, 0);
}

/**
 * End of a 7-day round that starts at `start`:
 * day 6 (Sunday) at endHour:endMinute:59.999 CPH.
 */
export function roundEndForStart(start: Date, endHour = 23, endMinute = 55): Date {
  const { year, month, day } = cphDateParts(start);
  return cphToUtc(year, month, day + 6, endHour, endMinute, 59, 999);
}

/** Next round starts at 00:00 CPH the day after the previous round ended. */
export function nextRoundStart(previousEnd: Date): Date {
  const { year, month, day } = cphDateParts(previousEnd);
  return cphToUtc(year, month, day + 1, 0, 0, 0, 0);
}

/** Reads round end time from season config with safe fallbacks. */
export function resolveRoundEndTime(config: { round_end_hour?: number; round_end_minute?: number } | null | undefined) {
  const hour = typeof config?.round_end_hour === "number" ? config.round_end_hour : 23;
  const minute = typeof config?.round_end_minute === "number" ? config.round_end_minute : 55;
  return { hour, minute };
}
