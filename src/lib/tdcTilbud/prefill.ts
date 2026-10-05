import type { SummaryLine } from "@/lib/tdcOpsummering/generateSummary";
import { HARDWARE, TILBUD_PRODUCTS } from "./catalog";
import { calcTilbud, fmtKr, type Quantities } from "./calc";

export interface TilbudPrefill {
  mobileText: string | null;
  mobilePrice: number;
  mbbText: string | null;
  mbbPrice: number;
  subsidy: number;
  hardware: string[];
  /** Én linje pr. abonnement til idriftsættelsesmailen */
  mailSubscriptions: string[];
}

export function buildPrefill(products: Quantities, hardware: Quantities): TilbudPrefill {
  const pick = (kind: "mobile" | "mbb") =>
    TILBUD_PRODUCTS.filter((p) => p.kind === kind && (products[p.id] ?? 0) > 0);
  const text = (list: typeof TILBUD_PRODUCTS) =>
    list.length ? list.map((p) => `${products[p.id]} x ${p.summaryName ?? p.name}`).join(", ") : null;
  const sum = (list: typeof TILBUD_PRODUCTS) => list.reduce((s, p) => s + (products[p.id] ?? 0) * p.price, 0);
  const mobile = pick("mobile");
  const mbb = pick("mbb");
  const mailSubscriptions = mobile.flatMap((p) => Array(products[p.id]).fill(p.mailSubscription ?? ""));
  return {
    mobileText: text(mobile),
    mobilePrice: sum(mobile),
    mbbText: text(mbb),
    mbbPrice: sum(mbb),
    subsidy: calcTilbud(products, hardware).subsidy,
    hardware: HARDWARE.filter((h) => (hardware[h.id] ?? 0) > 0).map((h) => `${hardware[h.id]} x ${h.name}`),
    mailSubscriptions,
  };
}

const kr = (n: number) => n.toLocaleString("da-DK", { maximumFractionDigits: 2 });

/** Indsætter tilbudsdata i opsummeringens pladsholdere (kun dansk tekst). */
export function applyPrefillToSummary(lines: SummaryLine[], p: TilbudPrefill | undefined): SummaryLine[] {
  if (!p) return lines;
  return lines.map((l) => {
    if (l.text.startsWith("Du får (antal + fulde produktnavn + datamængde)") && p.mobileText)
      return { text: `Du får ${p.mobileText} til en samlet månedlig pris på ${kr(p.mobilePrice)} kr. ekskl. moms.` };
    if (l.text.startsWith("Du får (antal + fulde produktnavn + hastighedsbegrænsning)") && p.mbbText)
      return { text: `Du får ${p.mbbText} til en samlet månedlig pris på ${kr(p.mbbPrice)} kr. ekskl. moms.` };
    if (l.text.startsWith("Du får et tilskud på (beløb)") && p.subsidy > 0)
      return { ...l, text: l.text.replace("(beløb)", fmtKr(p.subsidy)) };
    if (l.text.startsWith("(Nævn produkt og gigabyte") && p.hardware.length)
      return { text: p.hardware.join(", ") };
    return l;
  });
}
