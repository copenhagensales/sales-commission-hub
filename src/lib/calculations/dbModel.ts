/**
 * DB-model (dækningsbidrag) — beregningskerne uden I/O.
 *
 * ÉN SANDHED: både "DB Oversigt" (pr. team) og "DB per klient" bruger disse
 * funktioner, så samme team altid giver samme lederløn. Rækkefølgen er:
 *
 *   omsætning (justeret for annullering)
 *   − sælgerløn (provision + feriepenge)
 *   − sygefravær
 *   − øvrige omkostninger (teamudgifter + lokationsudgifter)
 *   − assistentløn (inkl. feriepenge)
 *   − ATP/barsel
 *   = DB før lederløn
 *   − lederløn (procent af DB før lederløn, dog mindst prorateret minimumsløn)
 *   − lederens feriepenge
 *   = DB
 *
 * Beløb der ikke kan beregnes pga. manglende grundlag returneres med
 * `hasBasis: false` og 0 kr., så UI kan vise "mangler grundlag" i stedet for
 * at lade et hul se ud som en reel nul-omkostning.
 */

import type { VacationPayRates } from "./calculationSettings";

// ---------------------------------------------------------------------------
// Lønmodel
// ---------------------------------------------------------------------------

/**
 * Eksplicit lønmodel på `personnel_salaries.compensation_model`.
 * - monthly_fixed: fast månedsløn (prorateres efter arbejdsdage/vagter)
 * - hourly:        timesats × timer
 * - percentage:    procent af DB (teamledere), med minimumsløn som gulv
 */
export type CompensationModel = "monthly_fixed" | "hourly" | "percentage";

export const COMPENSATION_MODELS: CompensationModel[] = [
  "monthly_fixed",
  "hourly",
  "percentage",
];

export const COMPENSATION_MODEL_LABELS: Record<CompensationModel, string> = {
  monthly_fixed: "Fast månedsløn",
  hourly: "Timeløn",
  percentage: "Procent af DB",
};

export type MissingBasisReason =
  | "no_salary_row"
  | "missing_model"
  | "missing_monthly_salary"
  | "missing_hourly_rate"
  | "missing_percentage_rate"
  /** Modellen kan ikke bruges i den sammenhæng (fx procentløn på en assistent) */
  | "unsupported_model";

export const MISSING_BASIS_LABELS: Record<MissingBasisReason, string> = {
  no_salary_row: "Ingen aktiv lønrække",
  missing_model: "Lønmodel mangler",
  missing_monthly_salary: "Månedsløn mangler",
  missing_hourly_rate: "Timesats mangler",
  missing_percentage_rate: "Procentsats og minimumsløn mangler",
  unsupported_model: "Lønmodel understøttes ikke her",
};

export interface RawCompensationRow {
  compensation_model?: string | null;
  monthly_salary?: number | string | null;
  hourly_rate?: number | string | null;
  percentage_rate?: number | string | null;
  minimum_salary?: number | string | null;
}

export interface ResolvedCompensation {
  model: CompensationModel;
  /** Fast månedsløn (kr.) — kun relevant for monthly_fixed */
  monthlySalary: number;
  /** Timesats (kr./time) — kun relevant for hourly */
  hourlyRate: number;
  /** Procentsats (16 = 16 %) — kun relevant for percentage */
  percentageRate: number;
  /** Minimumsløn (kr. pr. måned) — bruges som gulv for percentage */
  minimumSalary: number;
  /** false → beløbet kan ikke beregnes; vis "mangler grundlag" */
  hasBasis: boolean;
  missingReason: MissingBasisReason | null;
}

export function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isCompensationModel(value: unknown): value is CompensationModel {
  return (
    value === "monthly_fixed" || value === "hourly" || value === "percentage"
  );
}

/**
 * Læser lønmodellen eksplicit fra rækken — ingen gæt ud fra beløbets størrelse.
 *
 * Kun hvis `compensation_model` mangler (gamle rækker skrevet uden om
 * migreringen) udledes modellen af hvilket felt der er udfyldt, og rækken
 * markeres som manglende grundlag hvis intet beløb findes.
 */
export function resolveCompensation(
  row: RawCompensationRow | null | undefined
): ResolvedCompensation {
  if (!row) {
    return {
      model: "monthly_fixed",
      monthlySalary: 0,
      hourlyRate: 0,
      percentageRate: 0,
      minimumSalary: 0,
      hasBasis: false,
      missingReason: "no_salary_row",
    };
  }

  const monthlySalary = toNumber(row.monthly_salary);
  const hourlyRate = toNumber(row.hourly_rate);
  const percentageRate = toNumber(row.percentage_rate);
  const minimumSalary = toNumber(row.minimum_salary);

  let model: CompensationModel;
  let missingReason: MissingBasisReason | null = null;

  if (isCompensationModel(row.compensation_model)) {
    model = row.compensation_model;
  } else if (percentageRate > 0) {
    model = "percentage";
  } else if (hourlyRate > 0) {
    model = "hourly";
  } else if (monthlySalary > 0) {
    model = "monthly_fixed";
  } else {
    return {
      model: "monthly_fixed",
      monthlySalary,
      hourlyRate,
      percentageRate,
      minimumSalary,
      hasBasis: false,
      missingReason: "missing_model",
    };
  }

  let hasBasis: boolean;
  switch (model) {
    case "hourly":
      hasBasis = hourlyRate > 0;
      if (!hasBasis) missingReason = "missing_hourly_rate";
      break;
    case "percentage":
      hasBasis = percentageRate > 0 || minimumSalary > 0;
      if (!hasBasis) missingReason = "missing_percentage_rate";
      break;
    case "monthly_fixed":
    default:
      hasBasis = monthlySalary > 0;
      if (!hasBasis) missingReason = "missing_monthly_salary";
      break;
  }

  return {
    model,
    monthlySalary,
    hourlyRate,
    percentageRate,
    minimumSalary,
    hasBasis,
    missingReason,
  };
}

// ---------------------------------------------------------------------------
// Proratering
// ---------------------------------------------------------------------------

/**
 * Andel af en måned en periode dækker, målt i arbejdsdage/vagtdage.
 * 0 dage i måneden giver 1 (ingen proratering) frem for division med 0.
 */
export function prorationFactor(
  daysInPeriod: number,
  daysInMonth: number
): number {
  if (!Number.isFinite(daysInPeriod) || daysInPeriod < 0) return 0;
  if (!Number.isFinite(daysInMonth) || daysInMonth <= 0) return 1;
  return daysInPeriod / daysInMonth;
}

/** Proraterer et fast månedsbeløb og runder til øre. */
export function prorateMonthlyAmount(
  monthlyAmount: number,
  daysInPeriod: number,
  daysInMonth: number
): number {
  const factor = prorationFactor(daysInPeriod, daysInMonth);
  return Math.round(toNumber(monthlyAmount) * factor * 100) / 100;
}

// ---------------------------------------------------------------------------
// Feriepenge
// ---------------------------------------------------------------------------

export type EmployeeCostType = "seller" | "assistant" | "staff" | "leader";

/** Feriepengesats for en medarbejdertype ud fra de aktuelle indstillinger. */
export function vacationRateFor(
  type: EmployeeCostType,
  rates: VacationPayRates
): number {
  switch (type) {
    case "seller":
      return rates.seller;
    case "assistant":
      return rates.assistant;
    case "staff":
      return rates.staff;
    case "leader":
      return rates.leader;
  }
}

export interface SalaryCost {
  base: number;
  vacationPay: number;
  total: number;
}

/** Grundløn + feriepenge for en given sats. */
export function withVacationPay(base: number, rate: number): SalaryCost {
  const safeBase = toNumber(base);
  const vacationPay = safeBase * toNumber(rate);
  return { base: safeBase, vacationPay, total: safeBase + vacationPay };
}

/** Sælgeromkostning = provision + feriepenge. */
export function computeSellerSalaryCost(
  commission: number,
  rates: VacationPayRates
): SalaryCost {
  return withVacationPay(commission, rates.seller);
}

// ---------------------------------------------------------------------------
// ATP / barsel
// ---------------------------------------------------------------------------

export interface AtpInput {
  /** Antal AKTIVE medarbejdere på teamet (inkl. leder og assistenter) */
  activeMemberCount: number;
  /** Sats pr. medarbejder pr. måned */
  ratePerMember: number;
  /** Andel af måneden perioden dækker */
  prorationFactor: number;
}

/** ATP/barsel-omkostning for et team i en periode. */
export function computeAtpCost(input: AtpInput): number {
  const count = Math.max(0, Math.floor(toNumber(input.activeMemberCount)));
  const rate = Math.max(0, toNumber(input.ratePerMember));
  const factor = Math.max(0, toNumber(input.prorationFactor));
  return count * rate * factor;
}

// ---------------------------------------------------------------------------
// Lederløn
// ---------------------------------------------------------------------------

export interface LeaderSalaryInput {
  /** DB efter alle andre omkostninger, før lederløn */
  dbBeforeLeader: number;
  /** Procentsats (16 = 16 %) */
  percentageRate: number;
  /** Minimumsløn pr. måned */
  minimumSalary: number;
  /** Andel af måneden perioden dækker (bruges til at proratere minimumslønnen) */
  prorationFactor: number;
  /** Lederens feriepengesats (typisk 1 %) */
  leaderVacationRate: number;
  /** false når teamet mangler leder eller lønrække → 0 kr. + "mangler grundlag" */
  hasBasis?: boolean;
}

export interface LeaderSalaryResult {
  /** Procent × DB før lederløn (kan være negativ hvis DB er negativt) */
  calculated: number;
  /** Minimumsløn prorateret til perioden */
  proratedMinimum: number;
  /** Endelig lederløn = max(beregnet, prorateret minimum), aldrig negativ */
  salary: number;
  vacationPay: number;
  /** Lederløn + feriepenge */
  totalCost: number;
  usesMinimum: boolean;
  hasBasis: boolean;
}

/**
 * Lederløn = procent af DB før lederløn, med prorateret minimumsløn som gulv.
 * Minimumslønnen lægges IKKE oveni procenten — den er et gulv (Math.max).
 */
export function computeLeaderSalary(
  input: LeaderSalaryInput
): LeaderSalaryResult {
  const hasBasis = input.hasBasis !== false;
  if (!hasBasis) {
    return {
      calculated: 0,
      proratedMinimum: 0,
      salary: 0,
      vacationPay: 0,
      totalCost: 0,
      usesMinimum: false,
      hasBasis: false,
    };
  }

  const dbBeforeLeader = toNumber(input.dbBeforeLeader);
  const rate = toNumber(input.percentageRate) / 100;
  const calculated = dbBeforeLeader * rate;
  const proratedMinimum =
    Math.max(0, toNumber(input.minimumSalary)) *
    Math.max(0, toNumber(input.prorationFactor));

  // Negativ DB må ikke give negativ lederløn — gulvet er 0 (eller minimum).
  const salary = Math.max(calculated, proratedMinimum, 0);
  const vacationPay = salary * toNumber(input.leaderVacationRate);

  return {
    calculated,
    proratedMinimum,
    salary,
    vacationPay,
    totalCost: salary + vacationPay,
    usesMinimum: salary > 0 && salary === proratedMinimum && calculated < proratedMinimum,
    hasBasis: true,
  };
}

// ---------------------------------------------------------------------------
// Team-DB (fælles for DB Oversigt og DB per klient)
// ---------------------------------------------------------------------------

export interface TeamDbInput {
  /** Omsætning efter annulleringsjustering (inkl. evt. CPO-omsætning) */
  adjustedRevenue: number;
  /** Sælgerprovision (uden feriepenge) efter annulleringsjustering */
  adjustedSellerCommission: number;
  /** Sygefraværsomkostning i kr. */
  sickPayAmount?: number;
  /** Teamudgifter + lokationsudgifter i kr. */
  otherCosts?: number;
  /** Assistentløn inkl. feriepenge */
  assistantCost: number;
  /** ATP/barsel for teamet i perioden */
  atpCost: number;
  leader: {
    percentageRate: number;
    minimumSalary: number;
    hasBasis?: boolean;
  };
  /** Andel af måneden perioden dækker */
  prorationFactor: number;
  rates: VacationPayRates;
}

export interface TeamDbResult {
  sellerSalaryCost: number;
  sellerVacationPay: number;
  dbBeforeLeader: number;
  leader: LeaderSalaryResult;
  finalDb: number;
}

/**
 * Samlet DB for et team. Bruges direkte af DB Oversigt og pr. team af
 * DB per klient (hvor lederlønnen bagefter fordeles ud på klienterne).
 */
export function computeTeamDb(input: TeamDbInput): TeamDbResult {
  const seller = withVacationPay(
    input.adjustedSellerCommission,
    input.rates.seller
  );

  const dbBeforeLeader =
    toNumber(input.adjustedRevenue) -
    seller.total -
    toNumber(input.sickPayAmount) -
    toNumber(input.otherCosts) -
    toNumber(input.assistantCost) -
    toNumber(input.atpCost);

  const leader = computeLeaderSalary({
    dbBeforeLeader,
    percentageRate: input.leader.percentageRate,
    minimumSalary: input.leader.minimumSalary,
    prorationFactor: input.prorationFactor,
    leaderVacationRate: input.rates.leader,
    hasBasis: input.leader.hasBasis,
  });

  return {
    sellerSalaryCost: seller.total,
    sellerVacationPay: seller.vacationPay,
    dbBeforeLeader,
    leader,
    finalDb: dbBeforeLeader - leader.totalCost,
  };
}

// ---------------------------------------------------------------------------
// Fordeling ud på klienter
// ---------------------------------------------------------------------------

/**
 * Andel pr. post ud fra vægte (fx omsætning eller DB).
 * Negative vægte tælles som 0. Er summen 0, fordeles der ikke (alle 0),
 * så et team uden omsætning ikke får omkostninger fordelt tilfældigt ud.
 */
export function shares(weights: number[]): number[] {
  const safe = weights.map((w) => Math.max(0, toNumber(w)));
  const total = safe.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return safe.map(() => 0);
  return safe.map((w) => w / total);
}

/** Fordeler et samlet beløb ud efter vægte. */
export function allocateByWeights(total: number, weights: number[]): number[] {
  const amount = toNumber(total);
  return shares(weights).map((share) => amount * share);
}
