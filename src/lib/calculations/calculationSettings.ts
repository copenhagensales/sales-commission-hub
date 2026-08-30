/**
 * Calculation settings — pure types, defaults and parsing.
 *
 * These are the globale satser der tidligere lå hardkodet i komponenterne
 * (feriepengesatser, arbejdsdage pr. måned, ATP/barsel-sats og Stab-teamet).
 * De ligger nu i tabellen `calculation_settings` og læses via
 * `useCalculationSettings()`.
 *
 * SIKKERHED: hvis indstillingerne ikke kan læses (netværksfejl, tom tabel, RLS)
 * bruges DEFAULT_CALCULATION_SETTINGS. Defaults er identiske med den tidligere
 * hardkodede adfærd, så systemet aldrig regner anderledes ved et uheld.
 */

export const CALCULATION_SETTING_KEYS = [
  "vacation_pay_rates",
  "workdays_per_month",
  "atp_barsel_rate",
  "stab_team_id",
] as const;

export type CalculationSettingKey = (typeof CALCULATION_SETTING_KEYS)[number];

/** Feriepengesatser som brøk (0.125 = 12,5 %). */
export interface VacationPayRates {
  /** Sælgere — provision med udbetalt feriegodtgørelse */
  seller: number;
  /** Assisterende teamledere */
  assistant: number;
  /** Stabspersonale */
  staff: number;
  /** Teamledere — ferie med løn */
  leader: number;
}

export interface CalculationSettings {
  vacationPayRates: VacationPayRates;
  /** Normerede arbejdsdage pr. måned brugt til proratering af faste beløb */
  workdaysPerMonth: number;
  /** ATP + barsel pr. medarbejder pr. måned (kr.) */
  atpBarselRate: number;
  /** Team der bærer stabs-/fællesomkostninger */
  stabTeamId: string | null;
}

export const DEFAULT_CALCULATION_SETTINGS: CalculationSettings = {
  vacationPayRates: {
    seller: 0.125,
    assistant: 0.125,
    staff: 0.125,
    leader: 0.01,
  },
  workdaysPerMonth: 22,
  atpBarselRate: 381,
  // Stab — samme UUID som den tidligere hardkodede konstant i ClientDBTab
  stabTeamId: "09012ce9-e307-4f6d-a51e-f72af7200d74",
};

/** Grænser så en tastefejl ikke kan sætte en absurd sats i produktion. */
export const SETTING_LIMITS = {
  /** Feriepenge angives i procent i UI (0–100 %) */
  vacationPayPercent: { min: 0, max: 100 },
  workdaysPerMonth: { min: 1, max: 31 },
  atpBarselRate: { min: 0, max: 100000 },
} as const;

export interface SettingLimit {
  min: number;
  max: number;
}

/** Klamper et tal til [min, max]; ugyldige værdier giver fallback. */
export function clampSettingNumber(
  value: unknown,
  limit: SettingLimit,
  fallback: number
): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(limit.max, Math.max(limit.min, n));
}

/** Runder til hele antal arbejdsdage. */
export function clampWorkdays(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(
    Math.min(SETTING_LIMITS.workdaysPerMonth.max, Math.max(SETTING_LIMITS.workdaysPerMonth.min, n))
  );
}

/** Feriepengesats gemmes som brøk. Accepterer både 0.125 og 12.5 (procent). */
export function normalizeVacationRate(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  // Værdier > 1 tolkes som procent (12.5 → 0.125)
  const asFraction = n > 1 ? n / 100 : n;
  if (asFraction > 1) return fallback;
  return asFraction;
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CalculationSettingRow {
  key: string;
  value: unknown;
}

/**
 * Fletter rækker fra `calculation_settings` ind over defaults.
 * Ukendte nøgler ignoreres. Ugyldige værdier falder tilbage til default.
 */
export function parseCalculationSettings(
  rows: CalculationSettingRow[] | null | undefined
): CalculationSettings {
  const result: CalculationSettings = {
    vacationPayRates: { ...DEFAULT_CALCULATION_SETTINGS.vacationPayRates },
    workdaysPerMonth: DEFAULT_CALCULATION_SETTINGS.workdaysPerMonth,
    atpBarselRate: DEFAULT_CALCULATION_SETTINGS.atpBarselRate,
    stabTeamId: DEFAULT_CALCULATION_SETTINGS.stabTeamId,
  };

  for (const row of rows ?? []) {
    const value = row?.value as Record<string, unknown> | null | undefined;
    switch (row?.key) {
      case "vacation_pay_rates": {
        if (!value || typeof value !== "object") break;
        const defaults = DEFAULT_CALCULATION_SETTINGS.vacationPayRates;
        result.vacationPayRates = {
          seller: normalizeVacationRate(value.seller, defaults.seller),
          assistant: normalizeVacationRate(value.assistant, defaults.assistant),
          staff: normalizeVacationRate(value.staff, defaults.staff),
          leader: normalizeVacationRate(value.leader, defaults.leader),
        };
        break;
      }
      case "workdays_per_month": {
        if (!value || typeof value !== "object") break;
        result.workdaysPerMonth = clampWorkdays(
          value.days,
          DEFAULT_CALCULATION_SETTINGS.workdaysPerMonth
        );
        break;
      }
      case "atp_barsel_rate": {
        if (!value || typeof value !== "object") break;
        result.atpBarselRate = clampSettingNumber(
          value.amount,
          SETTING_LIMITS.atpBarselRate,
          DEFAULT_CALCULATION_SETTINGS.atpBarselRate
        );
        break;
      }
      case "stab_team_id": {
        if (!value || typeof value !== "object") break;
        const teamId = value.team_id;
        if (teamId === null) {
          result.stabTeamId = null;
        } else if (typeof teamId === "string" && UUID_PATTERN.test(teamId)) {
          result.stabTeamId = teamId;
        }
        break;
      }
      default:
        break;
    }
  }

  return result;
}

/** Bygger de jsonb-værdier der gemmes i `calculation_settings`. */
export function toSettingValue(
  key: CalculationSettingKey,
  settings: CalculationSettings
): Record<string, unknown> {
  switch (key) {
    case "vacation_pay_rates":
      return { ...settings.vacationPayRates };
    case "workdays_per_month":
      return { days: settings.workdaysPerMonth };
    case "atp_barsel_rate":
      return { amount: settings.atpBarselRate };
    case "stab_team_id":
      return { team_id: settings.stabTeamId };
  }
}

/** Formaterer en brøk som dansk procent (0.125 → "12,5 %"). */
export function formatRatePercent(rate: number, decimals = 1): string {
  return `${(rate * 100).toLocaleString("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  })} %`;
}
