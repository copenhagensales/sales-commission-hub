// calls-incremental (plan v2.4 §2 greb 3 / F1a): kald fra Adversus' dokumenterede /v1/calls hvert 2. minut i arbejdstiden
// (07–22 dansk tid) for alle aktive Adversus-integrationer med config.calls_v1 = true; om natten natlig backfill dag for dag.
// Egen vej uden for syncIntegration (ingen 21–08-spærring), egen vandmærke ('calls_v1'), start-filter m. 2 t overlap
// (timestamp-filteret er uvirksomt – målt 31/10), alle sider, dedup; budget pr. integration (formål 'kald').
// deno-lint-ignore-file no-explicit-any -- supabase-js/adapter er 3rd party
import { IngestionEngine } from "../core.ts";
import { getAdapter } from "../adapters/registry.ts";
import { getSyncState, upsertSyncState, recordSyncError } from "../utils/sync-state.ts";
import { TimeoutGuard } from "../utils/timeout-guard.ts";
import { hentCallsV1, mapCallEntry } from "../adapters/adversus-calls.ts";
import { lavAdversusBudget } from "../../_shared/adversus-budget.ts";

export const OVERLAP_MS = 2 * 60 * 60 * 1000;      // sent afsluttede kald: start-filter + 2 t overlap
export const BAGKANT_MS = 2 * 60 * 1000;            // kald, der stadig er i gang
export const MAKS_VINDUE_MS = 24 * 60 * 60 * 1000;  // ved langt efterslæb: højst 24 t ad gangen, resten næste kørsel

type LogFn = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void;

export function danskTime(nu = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(nu));
}
export function erArbejdstid(nu = new Date()): boolean { const t = danskTime(nu); return t >= 7 && t < 22; }

/** Inkrementelt vindue ud fra vandmærke: [vandmærke − overlap ; nu − bagkant], begrænset til 24 t. */
export function inkrementeltVindue(vandmaerke: Date | null, nu = new Date()): { fra: Date; til: Date; efterslaeb: boolean } {
  const til = new Date(nu.getTime() - BAGKANT_MS);
  const start = vandmaerke ? new Date(vandmaerke.getTime() - OVERLAP_MS) : new Date(til.getTime() - OVERLAP_MS);
  if (til.getTime() - start.getTime() > MAKS_VINDUE_MS) return { fra: start, til: new Date(start.getTime() + MAKS_VINDUE_MS), efterslaeb: true };
  return { fra: start, til, efterslaeb: false };
}

/** Natlig backfill: næste hele dag (dansk) bagud fra cursor, indtil 'dage' før i dag. Returnerer null, når der ikke er mere. */
export function backfillDag(cursor: string | null, dage: number, nu = new Date()): { dag: string; fra: string; til: string; naeste: string } | null {
  const iDag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu);
  const graense = new Date(`${iDag}T00:00:00Z`); graense.setUTCDate(graense.getUTCDate() - dage);
  const d = cursor ? new Date(`${cursor}T00:00:00Z`) : new Date(`${iDag}T00:00:00Z`);
  if (!cursor) d.setUTCDate(d.getUTCDate() - 1);
  if (d.getTime() < graense.getTime()) return null;
  const dag = d.toISOString().slice(0, 10);
  const fra = cphIso(dag, 0), til = cphIso(dag, 24);
  const n = new Date(d); n.setUTCDate(n.getUTCDate() - 1);
  return { dag, fra, til, naeste: n.toISOString().slice(0, 10) };
}
function cphIso(dag: string, time: number): string {
  const probe = new Date(`${dag}T12:00:00Z`);
  const offH = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(probe)) - 12;
  return new Date(Date.UTC(+dag.slice(0, 4), +dag.slice(5, 7) - 1, +dag.slice(8, 10), time - offH, 0)).toISOString();
}

export async function callsIncremental(supabase: any, engine: IngestionEngine, log: LogFn, opts: { integrationId?: string; tilstand?: "auto" | "inkrementel" | "backfill"; budgetMs?: number } = {}) {
  const timer = new TimeoutGuard(opts.budgetMs ?? 120_000, 0.85);
  const nu = new Date();
  const tilstand = opts.tilstand && opts.tilstand !== "auto" ? opts.tilstand : (erArbejdstid(nu) ? "inkrementel" : "backfill");
  let q = supabase.from("dialer_integrations").select("id, name, provider, api_url, config, calls_org_codes").eq("provider", "adversus").eq("is_active", true);
  if (opts.integrationId) q = q.eq("id", opts.integrationId);
  const { data: integrations, error } = await q;
  if (error) throw error;
  const valgte = (integrations ?? []).filter((i: any) => opts.integrationId || i?.config?.calls_v1 === true);
  const resultat: Record<string, unknown> = { tilstand, integrationer: valgte.length };
  for (const integ of valgte) {
    if (timer.isExpired()) { resultat[integ.name] = { sprunget_over: "tidsbudget" }; continue; }
    const budget = lavAdversusBudget(supabase, integ.id, "kald");
    try {
      const { data: credentials } = await supabase.rpc("get_dialer_credentials", { p_integration_id: integ.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
      const adapter: any = await getAdapter("adversus", credentials, integ.name, integ.api_url, integ.config, integ.calls_org_codes);
      adapter.setBudget?.(budget);
      const get = (sti: string) => adapter.getV1(sti) as Promise<unknown>;
      if (tilstand === "inkrementel") {
        const state = await getSyncState(supabase, integ.id, "calls_v1");
        const v = inkrementeltVindue(state?.last_success_at ? new Date(state.last_success_at) : null, nu);
        const { entries, sider, total } = await hentCallsV1(get, v.fra.toISOString(), v.til.toISOString());
        const calls = entries.map((e) => mapCallEntry(e, integ.name));
        const r = calls.length > 0 ? await engine.processCalls(calls, integ.id) : { processed: 0, errors: 0, matched: 0 };
        if ((r as any).errors === 0) await upsertSyncState(supabase, integ.id, "calls_v1", v.til);
        resultat[integ.name] = { vindue: [v.fra.toISOString(), v.til.toISOString()], efterslaeb: v.efterslaeb, sider, total, ...r, ventet: budget.ventet };
      } else {
        const dage = Number(integ?.config?.calls_v1_backfill_dage ?? 30);
        const state = await getSyncState(supabase, integ.id, "calls_v1_backfill");
        if (state?.cursor === "faerdig") { resultat[integ.name] = { backfill: "færdig" }; continue; }
        let cursor: string | null = state?.cursor ?? null; let dageKoert = 0;
        while (!timer.isExpired()) {
          const b = backfillDag(cursor, dage, nu);
          if (!b) { await upsertSyncState(supabase, integ.id, "calls_v1_backfill", nu, "faerdig"); break; }
          const { entries } = await hentCallsV1(get, b.fra, b.til);
          const calls = entries.map((e) => mapCallEntry(e, integ.name));
          const r = calls.length > 0 ? await engine.processCalls(calls, integ.id) : { processed: 0, errors: 0, matched: 0 };
          if ((r as any).errors > 0) { await recordSyncError(supabase, integ.id, "calls_v1_backfill", `fejl på ${b.dag}`); break; }
          cursor = b.naeste; dageKoert++;
          await upsertSyncState(supabase, integ.id, "calls_v1_backfill", nu, cursor);
        }
        resultat[integ.name] = { backfill_dage_koert: dageKoert, cursor, ventet: budget.ventet };
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("ERROR", `calls-incremental ${integ.name}: ${msg}`);
      await recordSyncError(supabase, integ.id, tilstand === "inkrementel" ? "calls_v1" : "calls_v1_backfill", msg);
      resultat[integ.name] = { fejl: msg };
    }
  }
  return resultat;
}
