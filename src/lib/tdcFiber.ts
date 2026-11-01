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
  tdc_fiber_salg_findes_ikke: "Salget findes ikke.",
  tdc_fiber_kun_i_dag: "Kun salg fra i dag kan rettes.",
  tdc_fiber_leadgiver_er_saelger: "Leadgiveren kan ikke være sælgeren selv.",
  tdc_fiber_ugyldig_dato: "Datoen skal ligge i den igangværende lønperiode og må ikke være efter i dag.",
  tdc_fiber_lukker_ikke_paa_listen: "Sælgeren skal stå på listen over fibersælgere.",
};
export function oversaetFejl(e: { code?: string; message?: string } | null | undefined): string | null {
  if (!e || e.code !== "P0001" || !e.message) return null;
  return FEJL[e.message] ?? null;
}

/** Dato (YYYY-MM-DD) som lokal kalenderdag. */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Lønperioden 15.→14.: første dag i den igangværende periode (databasen: tdc_fiber_periode_start). */
export function periodeStart(idag: Date): string {
  const d = new Date(idag.getFullYear(), idag.getMonth(), 15);
  if (idag.getDate() < 15) d.setMonth(d.getMonth() - 1);
  return iso(d);
}
export const datoIDag = (idag: Date) => iso(idag);

/** Admin-oprettelse: sælger skal vælges og datoen ligge i perioden til og med i dag. */
export function validerAdmin(k: FiberKladde, lukkerId: string | null, dato: string, idag: Date) {
  const fejl: ReturnType<typeof valider> & { lukker?: string; dato?: string } = valider(k, lukkerId);
  if (!lukkerId) fejl.lukker = "Vælg sælgeren.";
  if (fejl.leadgiver === "Du kan ikke være din egen leadgiver.") fejl.leadgiver = "Leadgiveren kan ikke være sælgeren selv.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dato) || dato < periodeStart(idag) || dato > iso(idag)) fejl.dato = "Vælg en dato i den igangværende lønperiode, senest i dag.";
  return fejl;
}
