// Fælles kvotebegrænser for Adversus' API (plan v2.4 §2 greb 1 / F1a): reservation i DB før hvert request,
// lease frigives efter at svaret er læst færdigt. Fejl i selve begrænseren (fx manglende migration) må ALDRIG stoppe
// Tier 1-salgs-sync: derfor fail-open med advarsel – Adversus' egne 429-svar er fortsat bagstopper.
// Udtømt kvote kaster ADVERSUS_BUDGET_<aarsag>; kalderen afbryder sin kørsel uden at flytte vandmærker (genoptages næste kørsel).
// deno-lint-ignore-file no-explicit-any -- service-klienten er 3rd party (supabase-js)

export type BudgetFormaal = "salg" | "kald" | "optagelse" | "diagnose" | "andet";

export interface AdversusBudget {
  /** Reserverer ét request; venter (højst maksVentMs for formålet) hvis kvoten er brugt. Returnerer lease eller null (fail-open). */
  reserver(antal?: number): Promise<string | null>;
  frigiv(lease: string | null): Promise<void>;
  /** Skifter formål (salg har forrang og længere ventetid). */
  saetFormaal(f: BudgetFormaal): void;
  readonly bruger: string;
  readonly formaal: BudgetFormaal;
  /** Antal gange kvoten var brugt (til log/metrik). */
  readonly ventet: number;
}

/** Budgetnøgle = API-bruger (ikke integration): delte logins deler kvote. Hash, så brugernavnet ikke gemmes. */
export async function budgetNoegle(username: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(username ?? "").trim().toLowerCase()));
  return "u:" + Array.from(new Uint8Array(buf)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const MAKS_VENT_MS: Record<BudgetFormaal, number> = { salg: 55_000, kald: 20_000, optagelse: 20_000, diagnose: 10_000, andet: 20_000 };

export function lavAdversusBudget(svc: any, bruger: string, formaal: BudgetFormaal): AdversusBudget {
  let ventet = 0; let aktueltFormaal: BudgetFormaal = formaal;
  return {
    bruger,
    get formaal() { return aktueltFormaal; },
    get ventet() { return ventet; },
    saetFormaal(f) { aktueltFormaal = f; },
    async reserver(antal = 1) {
      const start = Date.now(); const maksVent = MAKS_VENT_MS[aktueltFormaal] ?? 20_000;
      for (;;) {
        let data: any = null, error: any = null;
        try { ({ data, error } = await svc.rpc("adversus_api_budget_reserver", { p_bruger: bruger, p_formaal: aktueltFormaal, p_antal: antal })); }
        catch (e) { error = e; }
        if (error) { console.warn(`[adversus-budget] fail-open (${bruger}/${aktueltFormaal}): ${error?.code ?? error?.message ?? "fejl"}`); return null; }
        if (data?.ok === true) return String(data.lease);
        const vent = Math.min(Number(data?.vent_ms ?? 1000), 10_000);
        if (Date.now() - start + vent > maksVent) { console.warn(`[adversus-budget] kvote brugt (${bruger}/${aktueltFormaal}: ${data?.aarsag}) – opgiver efter ${Date.now() - start} ms`); throw new Error(`ADVERSUS_BUDGET_${String(data?.aarsag ?? "ukendt").toUpperCase()}`); }
        ventet++;
        await new Promise((r) => setTimeout(r, vent));
      }
    },
    async frigiv(lease) {
      if (!lease) return;
      try { await svc.rpc("adversus_api_budget_frigiv", { p_lease: lease }); } catch (e) { console.warn(`[adversus-budget] frigiv fejlede: ${(e as Error)?.message ?? "fejl"}`); }
    },
  };
}

export const erBudgetFejl = (e: unknown): boolean => e instanceof Error && e.message.startsWith("ADVERSUS_BUDGET_");

/** Standardbudget ud fra miljøet (service-klient) og API-brugernavnet – så ALLE adapter-instanser budgetterer, også dem uden kalder-opsætning. */
export async function lavStandardBudget(username: string, formaal: BudgetFormaal): Promise<AdversusBudget | null> {
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;  // lokal prøve uden miljø: fail-open
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  return lavAdversusBudget(createClient(url, key), await budgetNoegle(username), formaal);
}
