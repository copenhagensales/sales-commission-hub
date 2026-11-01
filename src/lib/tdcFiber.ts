/** Regler for tastning af TDC Erhverv fibersalg. Databasen (tdc_fiber_opret_salg) håndhæver det samme. */
export type FiberType = "fuldt" | "lukket";
export type FiberVariant = "HAP" | "VOK";

export interface FiberKladde {
  type: FiberType | null;
  variant: FiberVariant | null;
  mobilevoice: boolean;
  cvr: string;
  leadgiverId: string | null;
}

export const normaliserCvr = (v: string) => v.replace(/\s/g, "");
export const gyldigtCvr = (v: string) => /^[0-9]{8}$/.test(normaliserCvr(v));

/** Returnerer en dansk fejltekst pr. felt, eller tomt objekt hvis kladden kan sendes. */
export function valider(k: FiberKladde, mitId: string | null) {
  const fejl: Partial<Record<"type" | "variant" | "cvr" | "leadgiver", string>> = {};
  if (!k.type) fejl.type = "Vælg salgstype.";
  if (!k.variant) fejl.variant = "Vælg HAP eller VOK.";
  if (!gyldigtCvr(k.cvr)) fejl.cvr = "CVR skal være 8 cifre.";
  if (k.type === "lukket" && !k.leadgiverId) fejl.leadgiver = "Vælg hvem der gav leadet.";
  if (k.type === "fuldt" && k.leadgiverId) fejl.leadgiver = "Fuldt salg har ingen leadgiver.";
  if (k.leadgiverId && k.leadgiverId === mitId) fejl.leadgiver = "Du kan ikke være din egen leadgiver.";
  return fejl;
}

/** Præcise databasefejl (P0001 + ordret besked) → dansk tekst. Ukendt → null. */
const FEJL: Record<string, string> = {
  tdc_fiber_ingen_adgang: "Du er ikke på listen over fibersælgere.",
  tdc_fiber_ugyldig_type: "Ugyldig salgstype.",
  tdc_fiber_ugyldigt_cvr: "CVR skal være 8 cifre.",
  tdc_fiber_leadgiver_ikke_tilladt: "Fuldt salg har ingen leadgiver.",
  tdc_fiber_leadgiver_mangler: "Vælg hvem der gav leadet.",
  tdc_fiber_leadgiver_er_dig: "Du kan ikke være din egen leadgiver.",
  tdc_fiber_ugyldig_leadgiver: "Leadgiveren skal være aktiv i Relatel eller TDC Erhverv.",
  tdc_fiber_mangler_arbejdsmail: "Dit medarbejderkort mangler en arbejdsmail.",
  tdc_fiber_ugyldigt_produkt: "Produktet kan ikke tastes her.",
};
export function oversaetFejl(e: { code?: string; message?: string } | null | undefined): string | null {
  if (!e || e.code !== "P0001" || !e.message) return null;
  return FEJL[e.message] ?? null;
}
