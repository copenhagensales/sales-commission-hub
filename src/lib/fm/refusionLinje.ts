/**
 * Visningslinje "Vi betaler X · <kunde> refunderer Y · Netto Z".
 * Kun visning – DB-beregningen bruger fortsat location.daily_rate (netto).
 */
export interface RefusionLinjeData {
  dagspris?: number;
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
    dagspris: input.dailyRate,
    brutto: input.dailyRate + input.surchargePerDay,
    refusion: input.surchargePerDay,
    netto: input.dailyRate,
    refunderesAf: input.fundedByName ?? "kunden",
  };
}

/** "Coop direkte" har samme dagspris og separate tillæg som "Coop butik". */
export function coopDirekteLinje(input: {
  dailyRate: number | null;
  refundPerDay: number;
  refundClientName: string | null;
}): RefusionLinjeData | null {
  return tillaegsRefusion({ dailyRate: input.dailyRate, surchargePerDay: input.refundPerDay, fundedByName: input.refundClientName });
}

const kr = (n: number) => Math.round(n).toLocaleString("da-DK");

export function formatRefusionLinje(d: RefusionLinjeData): string {
  if (d.dagspris != null) return `Dagspris ${kr(d.dagspris)} · Eesy-tillæg ${kr(d.refusion)} refunderes af ${d.refunderesAf}`;
  return `Vi betaler ${kr(d.brutto)} · ${d.refunderesAf} refunderer ${kr(d.refusion)} · Netto ${kr(d.netto)}`;
}
