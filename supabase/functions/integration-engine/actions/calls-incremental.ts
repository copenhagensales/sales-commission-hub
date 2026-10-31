// calls-incremental (plan v2.4 §2 greb 3 / F1a): kald fra Adversus' dokumenterede /v1/calls hvert 2. minut i arbejdstiden
// (07–22 dansk tid) for aktive Adversus-integrationer med config.calls_v1 = true. Om natten: først DAGSAFSTEMNING af gårsdagen
// (tilbagevendende, fanger alt uden for overlap), derefter historisk backfill dag for dag (engangs, cursor).
// Egen vej uden for syncIntegration (ingen 21–08-spærring), eget vandmærke ('calls_v1'), start-filter m. 2 t overlap
// (timestamp-filteret er uvirksomt – målt 31/10), ALLE sider (ellers flyttes vandmærket ikke), dedup, lås pr. integration,
// tidsbudget kontrolleret mellem sider, budget pr. API-bruger (formål 'kald'). calls_v1 = true betyder også, at det gamle /cdr-trin
// i syncIntegration springes over (én skriver).
// deno-lint-ignore-file no-explicit-any -- supabase-js/adapter er 3rd party
import { IngestionEngine } from "../core.ts";
import { getAdapter } from "../adapters/registry.ts";
import { getSyncState, upsertSyncState, recordSyncError } from "../utils/sync-state.ts";
import { TimeoutGuard } from "../utils/timeout-guard.ts";
import { hentCallsV1, mapCallEntry } from "../adapters/adversus-calls.ts";
import { erBudgetFejl } from "../../_shared/adversus-budget.ts";

export const OVERLAP_MS = 2 * 60 * 60 * 1000;      // sent afsluttede kald: start-filter + 2 t overlap
export const BAGKANT_MS = 2 * 60 * 1000;            // kald, der stadig er i gang
export const MAKS_VINDUE_MS = 24 * 60 * 60 * 1000;  // ved langt efterslæb: højst 24 t ad gangen, resten næste kørsel
const LAAS_TTL_MS = 600 * 1000;  // > tidsbudget 120 s + én igangværende side (≤ 100 s request + 429-genforsøg ≤ 60 s) pr. dag/side (mock: op til ~370 s)
const MAKS_AFSTEMNINGSDAGE_PR_NAT = 7;

type LogFn = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void;

export function danskTime(nu = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(nu));
}
export function erArbejdstid(nu = new Date()): boolean { const t = danskTime(nu); return t >= 7 && t < 22; }
export function danskDato(nu = new Date()): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu); }

/** Inkrementelt vindue ud fra vandmærke: [vandmærke − overlap ; nu − bagkant], begrænset til 24 t. */
export function inkrementeltVindue(vandmaerke: Date | null, nu = new Date()): { fra: Date; til: Date; efterslaeb: boolean } {
  const til = new Date(nu.getTime() - BAGKANT_MS);
  const start = vandmaerke ? new Date(vandmaerke.getTime() - OVERLAP_MS) : new Date(til.getTime() - OVERLAP_MS);
  if (til.getTime() - start.getTime() > MAKS_VINDUE_MS) return { fra: start, til: new Date(start.getTime() + MAKS_VINDUE_MS), efterslaeb: true };
  return { fra: start, til, efterslaeb: false };
}

/** Midnat dansk tid som UTC-ISO; en dags vindue er [midnat(dag) ; midnat(dag+1)[ – korrekt også på DST-skiftedage (23/25 t). */
export function cphMidnat(dag: string): string {
  // Offset måles ved dagens start (00:00Z → dansk klokketime 1 eller 2), så DST-skiftedage får rigtig midnat
  const probe = new Date(`${dag}T00:00:00Z`);
  const offH = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false }).format(probe)) % 24;
  return new Date(probe.getTime() - offH * 3600000).toISOString();
}
export function plusDage(dag: string, n: number): string { const d = new Date(`${dag}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function dagsvindue(dag: string): { fra: string; til: string } { return { fra: cphMidnat(dag), til: cphMidnat(plusDage(dag, 1)) }; }

/** Backfill-cursor "dag|graense": grænsen fastlægges ved første kørsel og flytter sig ikke under pauser. */
export function parseBackfillCursor(cursor: string | null, dage: number, nu = new Date()): { dag: string; graense: string } {
  const iDag = danskDato(nu);
  if (cursor && cursor.includes("|")) { const [dag, graense] = cursor.split("|"); return { dag, graense }; }
  if (cursor) return { dag: cursor, graense: plusDage(cursor, -(dage - 1)) };  // gammelt format uden grænse: bevar 'dage' dage fra cursoren (aldrig for tidlig 'færdig')
  return { dag: plusDage(iDag, -1), graense: plusDage(iDag, -dage) };
}
/** Historisk backfill: næste hele dag bagud fra cursor, indtil den faste grænse. null = færdig. */
export function backfillDag(cursor: string | null, dage: number, nu = new Date()): { dag: string; fra: string; til: string; naeste: string } | null {
  const { dag, graense } = parseBackfillCursor(cursor, dage, nu);
  if (dag < graense) return null;
  return { dag, ...dagsvindue(dag), naeste: `${plusDage(dag, -1)}|${graense}` };
}
/** Dagsafstemning: alle dage fra (sidst afstemt + 1) til og med i går, ældste først, højst maks pr. nat. */
export function afstemningsDage(sidstAfstemt: string | null, iGaar: string, maks = MAKS_AFSTEMNINGSDAGE_PR_NAT): string[] {
  const ud: string[] = [];
  let d = sidstAfstemt ? plusDage(sidstAfstemt, 1) : iGaar;  // ingen datoklampning: ældste manglende dag først, antalsloftet fordeler over flere nætter
  while (d <= iGaar && ud.length < maks) { ud.push(d); d = plusDage(d, 1); }
  return ud;
}

async function laas(supabase: any, noegle: string, runId: string): Promise<boolean> {
  await supabase.from("provider_sync_locks").delete().lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("provider_sync_locks").insert({ provider: noegle, locked_at: new Date().toISOString(), locked_by: runId, expires_at: new Date(Date.now() + LAAS_TTL_MS).toISOString() });
  return !error;
}
async function frigivLaas(supabase: any, noegle: string, runId: string) { await supabase.from("provider_sync_locks").delete().eq("provider", noegle).eq("locked_by", runId); }

export async function callsIncremental(supabase: any, engine: IngestionEngine, log: LogFn, opts: { integrationId?: string; tilstand?: "auto" | "inkrementel" | "nat"; budgetMs?: number } = {}) {
  const timer = new TimeoutGuard(opts.budgetMs ?? 120_000, 0.85);
  const stop = () => timer.isExpired();
  const nu = new Date();
  const tilstand = opts.tilstand && opts.tilstand !== "auto" ? opts.tilstand : (erArbejdstid(nu) ? "inkrementel" : "nat");
  let q = supabase.from("dialer_integrations").select("id, name, provider, api_url, config, calls_org_codes").eq("provider", "adversus").eq("is_active", true);
  if (opts.integrationId) q = q.eq("id", opts.integrationId);
  const { data: integrations, error } = await q;
  if (error) throw error;
  const valgte = (integrations ?? []).filter((i: any) => i?.config?.calls_v1 === true);  // aktiveringsflag gælder ALTID, også med integrationId
  const resultat: Record<string, unknown> = { tilstand, integrationer: valgte.length };
  const runId = `kald_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  for (const integ of valgte) {
    if (stop()) { resultat[integ.name] = { sprunget_over: "tidsbudget" }; continue; }
    const laasNoegle = `kald:${integ.id}`;
    if (!(await laas(supabase, laasNoegle, runId))) { resultat[integ.name] = { sprunget_over: "laast" }; continue; }
    let budgetVentet = 0;
    try {
      const { data: credentials } = await supabase.rpc("get_dialer_credentials", { p_integration_id: integ.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
      const adapter: any = await getAdapter("adversus", credentials, integ.name, integ.api_url, integ.config, integ.calls_org_codes);
      adapter.setBudgetFormaal?.("kald");  // adapteren budgetterer sig selv (nøgle = hash af API-brugernavn)
      const budget = { get ventet() { return Number(adapter.budgetVentet?.() ?? 0); } };
      const get = (sti: string) => adapter.getV1(sti) as Promise<unknown>;
      const hentOgGem = async (fra: string, til: string): Promise<{ komplet: boolean; processed: number; errors: number; sider: number; total: number | null }> => {
        const { entries, sider, total, komplet } = await hentCallsV1(get, fra, til, { stop });
        if (!komplet) return { komplet: false, processed: 0, errors: 0, sider, total };
        const calls = entries.map((e) => mapCallEntry(e, integ.name));
        const r: any = calls.length > 0 ? await engine.processCalls(calls, integ.id) : { processed: 0, errors: 0 };
        return { komplet: true, processed: Number(r.processed ?? 0), errors: Number(r.errors ?? 0), sider, total };
      };
      if (tilstand === "inkrementel") {
        const state = await getSyncState(supabase, integ.id, "calls_v1");
        const v = inkrementeltVindue(state?.last_success_at ? new Date(state.last_success_at) : null, nu);
        const r = await hentOgGem(v.fra.toISOString(), v.til.toISOString());
        if (r.komplet && r.errors === 0) await upsertSyncState(supabase, integ.id, "calls_v1", v.til);
        else log("WARN", `calls-incremental ${integ.name}: vandmærke IKKE flyttet (komplet=${r.komplet}, fejl=${r.errors})`);
        resultat[integ.name] = { vindue: [v.fra.toISOString(), v.til.toISOString()], efterslaeb: v.efterslaeb, ...r, ventet: budget.ventet };
      } else {
        // Nat 1: dagsafstemning (tilbagevendende) – alle dage siden sidst afstemt t.o.m. i går, ældste først; fanger kald uden for overlap/efterslæb
        const iGaar = plusDage(danskDato(nu), -1);
        const afst = await getSyncState(supabase, integ.id, "calls_v1_afstemning");
        const dage = afstemningsDage(afst?.cursor ?? null, iGaar);
        const afstemning: unknown[] = [];
        for (const dag of dage) {
          if (stop()) break;
          const dv = dagsvindue(dag);
          const r = await hentOgGem(dv.fra, dv.til);
          afstemning.push({ dag, ...r });
          if (!(r.komplet && r.errors === 0)) break;  // cursor flyttes kun fremad over komplette dage
          await upsertSyncState(supabase, integ.id, "calls_v1_afstemning", nu, dag);
        }
        // Nat 2: historisk backfill (engangs) dag for dag bagud
        const bfDage = Number(integ?.config?.calls_v1_backfill_dage ?? 30);
        const bf = await getSyncState(supabase, integ.id, "calls_v1_backfill");
        let cursor: string | null = bf?.cursor ?? null; let dageKoert = 0; let backfill: unknown = cursor === "faerdig" ? "færdig" : null;
        while (cursor !== "faerdig" && !stop()) {
          const b = backfillDag(cursor, bfDage, nu);
          if (!b) { await upsertSyncState(supabase, integ.id, "calls_v1_backfill", nu, "faerdig"); cursor = "faerdig"; backfill = "færdig nu"; break; }
          const r = await hentOgGem(b.fra, b.til);
          if (!r.komplet || r.errors > 0) { await recordSyncError(supabase, integ.id, "calls_v1_backfill", `ufuldstændig/fejl på ${b.dag}`); backfill = { stoppet_ved: b.dag, komplet: r.komplet, fejl: r.errors }; break; }
          cursor = b.naeste; dageKoert++;
          await upsertSyncState(supabase, integ.id, "calls_v1_backfill", nu, cursor);
        }
        resultat[integ.name] = { afstemning: afstemning.length ? afstemning : "allerede", backfill: backfill ?? { dage_koert: dageKoert, cursor }, ventet: budget.ventet };
      }
      budgetVentet = budget.ventet;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(erBudgetFejl(e) ? "WARN" : "ERROR", `calls-incremental ${integ.name}: ${msg}`);
      await recordSyncError(supabase, integ.id, tilstand === "inkrementel" ? "calls_v1" : "calls_v1_nat", msg);
      resultat[integ.name] = { fejl: msg, ventet: budgetVentet };
    } finally {
      await frigivLaas(supabase, laasNoegle, runId);
    }
  }
  return resultat;
}
