/**
 * Visningslinje "Vi betaler X · <kunde> refunderer Y · Netto Z".
 * Kun visning – DB-beregningen bruger fortsat location.daily_rate (netto).
 */
export interface RefusionLinjeData {
  brutto: number;
  refusion: number;
  netto: number;
  refunderesAf: string;
}

export function lokationsRefusion(input: {
  dailyRate: number | null;
  grossDailyRate: number | null;
  refundDailyRate: number | null;
  refundClientName: string | null;
}): RefusionLinjeData | null {
  const { dailyRate, grossDailyRate, refundDailyRate } = input;
  if (refundDailyRate == null || refundDailyRate <= 0) return null;
  const netto = dailyRate ?? (grossDailyRate != null ? grossDailyRate - refundDailyRate : null);
  if (netto == null) return null;
  return {
    brutto: grossDailyRate ?? netto + refundDailyRate,
    refusion: refundDailyRate,
    netto,
    refunderesAf: input.refundClientName ?? "kunden",
  };
}

/** Coop-kæder: tillægget lægges oven på grundsatsen og refunderes af tillæggets kunde. */
export function tillaegsRefusion(input: {
  dailyRate: number | null;
  surchargePerDay: number;
  fundedByName: string | null;
}): RefusionLinjeData | null {
  if (input.dailyRate == null || input.surchargePerDay <= 0) return null;
  return {
    brutto: input.dailyRate + input.surchargePerDay,
    refusion: input.surchargePerDay,
    netto: input.dailyRate,
    refunderesAf: input.fundedByName ?? "kunden",
  };
}

/** "Coop direkte": dagsprisen er det vi betaler; kædereglens kunde refunderer. */
export function coopDirekteLinje(input: {
  dailyRate: number | null;
  refundPerDay: number;
  refundClientName: string | null;
}): RefusionLinjeData | null {
  if (input.dailyRate == null || input.refundPerDay <= 0) return null;
  return {
    brutto: input.dailyRate,
    refusion: input.refundPerDay,
    netto: Math.max(0, input.dailyRate - input.refundPerDay),
    refunderesAf: input.refundClientName ?? "kunden",
  };
}

const kr = (n: number) => Math.round(n).toLocaleString("da-DK");

export function formatRefusionLinje(d: RefusionLinjeData): string {
  return `Vi betaler ${kr(d.brutto)} · ${d.refunderesAf} refunderer ${kr(d.refusion)} · Netto ${kr(d.netto)}`;
}
