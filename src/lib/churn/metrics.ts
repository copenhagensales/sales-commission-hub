/**
 * Central beregningslag for CEO churn-dashboard.
 *
 * ALLE tal i dashboardet stammer fra RPC'en `get_churn_dashboard_metrics`.
 * Denne fil indeholder udelukkende afledte, rene beregninger oven på det
 * centrale datagrundlag — der må ikke findes konkurrerende churnformler
 * i React-komponenter.
 */

export interface ChurnSettings {
  official_horizon_days: number;
  official_month_count: number;
  target_60d_rate: number | null;
  minimum_n: number;
  yellow_threshold_pp: number;
  orange_threshold_pp: number;
  material_trend_pp: number;
  benchmark_min_n: number;
  benchmark_min_months: number;
}

export interface ChurnBands {
  b0_7: number;
  b8_14: number;
  b15_30: number;
  b31_60: number;
}

export interface ChurnCompanyRaw extends ChurnBands {
  starters: number;
  exits: number;
  recent_n: number;
  recent_x: number;
  prev_n: number;
  prev_x: number;
}

export interface ChurnTeamRaw extends ChurnCompanyRaw {
  team_key: string;
  months_with_data: number;
}

export interface ChurnTeamMonthRaw extends ChurnBands {
  team_key: string;
  m: string;
  starters: number;
  exits: number;
}

export interface ChurnLeaderRaw {
  leader_key: string;
  starters: number;
  exits: number;
}

export interface ChurnQuality {
  total_rows: number;
  duplicates: number;
  missing_start_date: number;
  exit_before_start: number;
  outside_scope: number;
  future_start: number;
  valid_spells_n: number;
  unknown_team: number;
  unknown_leader: number;
  unknown_exit_reason: number;
  total_exits_all: number;
}

export interface ChurnHeadcountBridge {
  all_active_profiles: number;
  upcoming_starters: number;
  staff_out_of_scope: number;
  invalid_dates: number;
  official_headcount: number;
}

export interface ChurnMetricsPayload {
  as_of_date: string;
  as_of_source: string;
  timezone: string;
  settings: ChurnSettings;
  mature_months: string[];
  mature_months_available: number;
  latest_mature_month: string | null;
  company: ChurnCompanyRaw;
  monthly: Array<{ m: string; starters: number; exits: number }>;
  team_totals: ChurnTeamRaw[];
  team_months: ChurnTeamMonthRaw[];
  leader_totals: ChurnLeaderRaw[];
  leader_dimension_available: boolean;
  exit_reason_available: boolean;
  horizon_14: { n: number; x: number };
  horizon_30: { n: number; x: number };
  observation: { d0_13: number; d14_29: number; d30_59: number };
  upcoming_starters: number;
  /** Startere der er kommet EFTER seneste modne startmåned — indgår ikke i 60-dages raten endnu. */
  immature_total?: number;
  immature_teams?: Array<{ team_key: string; starters: number; exits_so_far: number }>;
  quality: ChurnQuality;
  headcount_bridge: ChurnHeadcountBridge;
}

export const UNKNOWN_TEAM_KEY = "Øvrige / ukendt team";
export const UNKNOWN_LEADER_KEY = "Ukendt leder";

/** Vægtet rate i procent. Returnerer null ved nævner 0 — aldrig NaN. */
export function rate(x: number, n: number): number | null {
  if (!n || n <= 0) return null;
  return (x / n) * 100;
}

/** Formatér procent med maks. én decimal. */
export function fmtPct(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  return `${value.toFixed(decimals).replace(".", ",")} %`;
}

export function fmtPp(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "–";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals).replace(".", ",")} pp`;
}

/** Formatér "2026-05-01" eller "2026-05" som "maj 2026". */
export function fmtMonth(monthISO: string | null | undefined): string {
  if (!monthISO) return "–";
  const [y, m] = monthISO.split("-").map(Number);
  if (!y || !m) return monthISO;
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("da-DK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label;
}

/** Modenhedsregel: månedens sidste dag + horisont skal være nået. */
export function isMonthMature(monthISO: string, asOfISO: string, horizonDays: number): boolean {
  const [y, m] = monthISO.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0));
  const threshold = new Date(lastDay.getTime() + horizonDays * 86400000);
  const asOf = new Date(`${asOfISO.slice(0, 10)}T00:00:00Z`);
  return threshold.getTime() <= asOf.getTime();
}

/** Vælger præcis de N seneste modne måneder — uden kunstig udfyldning. */
export function selectMatureMonths(allMonths: string[], asOfISO: string, horizonDays: number, count: number): string[] {
  const mature = allMonths.filter((m) => isMonthMature(m, asOfISO, horizonDays)).sort();
  return mature.slice(Math.max(0, mature.length - count));
}

/** Er et ansættelsesforløb kvalificeret til horisont-målingen (observationstid nået)? */
export function isQualifiedForHorizon(startISO: string, asOfISO: string, horizonDays: number): boolean {
  const tenure = tenureDays(startISO, asOfISO);
  return tenure !== null && tenure >= horizonDays;
}

/** Faktisk exit inden for horisonten. Dag 0 og dag = horisont tæller med. */
export function isExitWithinHorizon(startISO: string, exitISO: string | null, horizonDays: number): boolean {
  if (!exitISO) return false;
  const day = tenureDays(startISO, exitISO);
  return day !== null && day >= 0 && day <= horizonDays;
}

export function tenureDays(startISO: string | null, endISO: string | null): number | null {
  if (!startISO || !endISO) return null;
  const a = new Date(`${startISO.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${endISO.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export type ChurnStatusKey = "green" | "yellow" | "orange" | "red" | "grey" | "neutral";

export interface ChurnStatus {
  key: ChurnStatusKey;
  label: string;
}

/** Faste statusfarver, læst fra settings. Grå ved lavt datagrundlag, neutral uden mål. */
export function statusFor(rateValue: number | null, n: number, settings: ChurnSettings): ChurnStatus {
  if (rateValue === null || n <= 0) return { key: "neutral", label: "Data mangler" };
  if (n < settings.minimum_n) return { key: "grey", label: "Lavt datagrundlag" };
  const target = settings.target_60d_rate;
  if (target === null || target === undefined) return { key: "neutral", label: "Mål ikke sat" };
  const gap = rateValue - target;
  if (gap <= 0) return { key: "green", label: "På eller under mål" };
  if (gap <= settings.yellow_threshold_pp) return { key: "yellow", label: "Lidt over mål" };
  if (gap <= settings.orange_threshold_pp) return { key: "orange", label: "Væsentligt over mål" };
  return { key: "red", label: "Kritisk over mål" };
}

export const STATUS_CLASSES: Record<ChurnStatusKey, string> = {
  green: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  yellow: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  orange: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  red: "bg-red-500/15 text-red-500 border-red-500/30",
  grey: "bg-muted text-muted-foreground border-border",
  neutral: "bg-primary/10 text-foreground border-border",
};

export interface DerivedPeriod {
  x: number;
  n: number;
  rate: number | null;
}

export interface DerivedGroup {
  key: string;
  starters: number;
  exits: number;
  rate: number | null;
  retained: number;
  retentionRate: number | null;
  startersPerRetained: number | null;
  recent: DerivedPeriod;
  previous: DerivedPeriod;
  deltaPp: number | null;
  gapPp: number | null;
  expectedExitsAtTarget: number | null;
  excessExits: number | null;
  bands: ChurnBands;
  monthsWithData: number;
  status: ChurnStatus;
  lowData: boolean;
  estimatedPeopleImpact: number | null;
  shareOfCompanyExits: number | null;
  shareOfCompanyExcess: number | null;
  benchmarkEligible: boolean;
  gapToBestPeerPp: number | null;
}

function deriveBase(
  key: string,
  raw: ChurnCompanyRaw & { months_with_data?: number },
  settings: ChurnSettings,
): DerivedGroup {
  const r = rate(raw.exits, raw.starters);
  const recent: DerivedPeriod = { x: raw.recent_x, n: raw.recent_n, rate: rate(raw.recent_x, raw.recent_n) };
  const previous: DerivedPeriod = { x: raw.prev_x, n: raw.prev_n, rate: rate(raw.prev_x, raw.prev_n) };
  const deltaPp = recent.rate !== null && previous.rate !== null ? recent.rate - previous.rate : null;
  const target = settings.target_60d_rate;
  const retained = raw.starters - raw.exits;
  const expected = target !== null && target !== undefined ? (raw.starters * target) / 100 : null;
  return {
    key,
    starters: raw.starters,
    exits: raw.exits,
    rate: r,
    retained,
    retentionRate: r === null ? null : 100 - r,
    startersPerRetained: retained > 0 ? raw.starters / retained : null,
    recent,
    previous,
    deltaPp,
    gapPp: r !== null && target !== null && target !== undefined ? r - target : null,
    expectedExitsAtTarget: expected,
    excessExits: expected === null ? null : raw.exits - expected,
    bands: { b0_7: raw.b0_7, b8_14: raw.b8_14, b15_30: raw.b15_30, b31_60: raw.b31_60 },
    monthsWithData: raw.months_with_data ?? 0,
    status: statusFor(r, raw.starters, settings),
    lowData: raw.starters < settings.minimum_n,
    estimatedPeopleImpact:
      recent.rate !== null && previous.rate !== null ? ((recent.rate - previous.rate) / 100) * recent.n : null,
    shareOfCompanyExits: null,
    shareOfCompanyExcess: null,
    benchmarkEligible: false,
    gapToBestPeerPp: null,
  };
}

export function deriveCompany(payload: ChurnMetricsPayload): DerivedGroup {
  return deriveBase("Virksomheden", payload.company, payload.settings);
}

export function deriveTeams(payload: ChurnMetricsPayload): DerivedGroup[] {
  const settings = payload.settings;
  const company = payload.company;
  const rows = payload.team_totals.map((t) => deriveBase(t.team_key, t, settings));

  const totalExits = company.exits;
  const totalPositiveExcess = rows.reduce((sum, r) => sum + Math.max(0, r.excessExits ?? 0), 0);

  rows.forEach((r) => {
    r.shareOfCompanyExits = totalExits > 0 ? (r.exits / totalExits) * 100 : null;
    r.shareOfCompanyExcess =
      r.excessExits !== null && totalPositiveExcess > 0 ? (Math.max(0, r.excessExits) / totalPositiveExcess) * 100 : null;
    r.benchmarkEligible = r.starters >= settings.benchmark_min_n && r.monthsWithData >= settings.benchmark_min_months;
  });

  const eligible = rows.filter((r) => r.benchmarkEligible && r.rate !== null);
  if (eligible.length >= 2) {
    const best = Math.min(...eligible.map((r) => r.rate as number));
    rows.forEach((r) => {
      r.gapToBestPeerPp = r.rate === null ? null : r.rate - best;
    });
  }
  return rows;
}

export interface ChurnSignal {
  team: string;
  deltaPp: number;
  recent: DerivedPeriod;
  previous: DerivedPeriod;
  peopleImpact: number;
  multipleCohorts: boolean;
}

/**
 * "Siden sidst": maks. 3 negative og 2 positive materielle signaler.
 * Kun teams hvor både recent_n og previous_n opfylder minimum_n.
 */
export function buildSignals(
  teams: DerivedGroup[],
  settings: ChurnSettings,
): { negative: ChurnSignal[]; positive: ChurnSignal[] } {
  const qualified = teams.filter(
    (t) =>
      t.recent.n >= settings.minimum_n &&
      t.previous.n >= settings.minimum_n &&
      t.deltaPp !== null &&
      t.estimatedPeopleImpact !== null,
  );

  const signals: ChurnSignal[] = qualified
    .map((t) => ({
      team: t.key,
      deltaPp: t.deltaPp as number,
      recent: t.recent,
      previous: t.previous,
      peopleImpact: t.estimatedPeopleImpact as number,
      multipleCohorts: t.monthsWithData > 1,
    }))
    .filter((s) => Math.abs(s.deltaPp) >= settings.material_trend_pp || Math.abs(s.peopleImpact) >= 3);

  const negative = signals
    .filter((s) => s.deltaPp > 0)
    .sort((a, b) => b.peopleImpact - a.peopleImpact || b.deltaPp - a.deltaPp)
    .slice(0, 3);

  const positive = signals
    .filter((s) => s.deltaPp < 0)
    .sort((a, b) => a.peopleImpact - b.peopleImpact || a.deltaPp - b.deltaPp)
    .slice(0, 2);

  return { negative, positive };
}

/** Sorteringsrækkefølge for den prioriterede teamtabel. */
export function sortTeamsForPriority(teams: DerivedGroup[], settings: ChurnSettings): DerivedGroup[] {
  const hasTarget = settings.target_60d_rate !== null && settings.target_60d_rate !== undefined;
  return [...teams].sort((a, b) => {
    if (hasTarget) {
      const ea = Math.max(0, a.excessExits ?? 0);
      const eb = Math.max(0, b.excessExits ?? 0);
      if (eb !== ea) return eb - ea;
      return b.exits - a.exits;
    }
    const ia = a.estimatedPeopleImpact ?? -Infinity;
    const ib = b.estimatedPeopleImpact ?? -Infinity;
    if (ib !== ia) return ib - ia;
    const ra = a.rate ?? -Infinity;
    const rb = b.rate ?? -Infinity;
    if (rb !== ra) return rb - ra;
    return b.starters - a.starters;
  });
}

/** Summen af exitperioder skal være identisk med den officielle tæller. */
export function bandsSum(bands: ChurnBands): number {
  return bands.b0_7 + bands.b8_14 + bands.b15_30 + bands.b31_60;
}

/**
 * Første fuldt berørte startkohorte: den efterfølgende hele startmåned,
 * medmindre handlingen starter på den 1. i måneden.
 */
export function firstMeasurableCohortMonth(startISO: string): string {
  const d = new Date(`${startISO.slice(0, 10)}T00:00:00Z`);
  const day = d.getUTCDate();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const target = day === 1 ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m + 1, 1));
  return target.toISOString().slice(0, 10);
}

/** Effektmåling: 3 fuldt modne hele startmåneder før vs. efter handlingen. */
export function actionEffect(
  monthly: Array<{ m: string; starters: number; exits: number }>,
  firstCohortMonth: string,
  asOfISO: string,
  horizonDays: number,
): {
  baseline: DerivedPeriod;
  after: DerivedPeriod;
  deltaPp: number | null;
  peopleImpact: number | null;
  measurable: boolean;
} {
  const mature = monthly.filter((r) => isMonthMature(r.m, asOfISO, horizonDays)).sort((a, b) => a.m.localeCompare(b.m));
  const before = mature.filter((r) => r.m < firstCohortMonth).slice(-3);
  const after = mature.filter((r) => r.m >= firstCohortMonth).slice(0, 3);

  const agg = (rows: typeof mature): DerivedPeriod => {
    const n = rows.reduce((s, r) => s + r.starters, 0);
    const x = rows.reduce((s, r) => s + r.exits, 0);
    return { n, x, rate: rate(x, n) };
  };

  const baseline = agg(before);
  const afterP = agg(after);
  const measurable = before.length >= 1 && after.length >= 1 && baseline.rate !== null && afterP.rate !== null;
  const deltaPp = measurable ? (afterP.rate as number) - (baseline.rate as number) : null;
  return {
    baseline,
    after: afterP,
    deltaPp,
    peopleImpact: deltaPp === null ? null : (deltaPp / 100) * afterP.n,
    measurable,
  };
}
