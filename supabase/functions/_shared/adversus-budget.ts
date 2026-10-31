// Fælles kvotebegrænser for Adversus' API (plan v2.4 §2 greb 1 / F1a): reservation i DB før hvert request,
// lease frigives efter svaret. Fejl i begrænseren (fx manglende migration) må ALDRIG stoppe Tier 1-salgs-sync:
// derfor fail-open med advarsel – Adversus' egne 429-svar er fortsat bagstopper.
// deno-lint-ignore-file no-explicit-any -- service-klienten er 3rd party (supabase-js)

export type BudgetFormaal = "salg" | "kald" | "optagelse" | "diagnose" | "andet";

export interface AdversusBudget {
  /** Reserverer ét request; venter (højst maksVentMs) hvis kvoten er brugt. Returnerer lease eller null (fail-open). */
  reserver(antal?: number): Promise<string | null>;
  frigiv(lease: string | null): Promise<void>;
  readonly bruger: string;
  readonly formaal: BudgetFormaal;
  /** Antal gange kvoten var brugt (til log/metrik). */
  readonly ventet: number;
}

export function lavAdversusBudget(svc: any, bruger: string, formaal: BudgetFormaal, maksVentMs = 20_000): AdversusBudget {
  let ventet = 0;
  return {
    bruger, formaal,
    get ventet() { return ventet; },
    async reserver(antal = 1) {
      const start = Date.now();
      for (;;) {
        let data: any = null, error: any = null;
        try { ({ data, error } = await svc.rpc("adversus_api_budget_reserver", { p_bruger: bruger, p_formaal: formaal, p_antal: antal })); }
        catch (e) { error = e; }
        if (error) { console.warn(`[adversus-budget] fail-open (${bruger}/${formaal}): ${error?.code ?? error?.message ?? "fejl"}`); return null; }
        if (data?.ok === true) return String(data.lease);
        const vent = Math.min(Number(data?.vent_ms ?? 1000), 10_000);
        if (Date.now() - start + vent > maksVentMs) { console.warn(`[adversus-budget] kvote brugt (${bruger}/${formaal}: ${data?.aarsag}) – opgiver efter ${Date.now() - start} ms`); throw new Error(`ADVERSUS_BUDGET_${String(data?.aarsag ?? "ukendt").toUpperCase()}`); }
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
