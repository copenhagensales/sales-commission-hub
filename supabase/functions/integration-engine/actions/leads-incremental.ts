// leads-incremental (plan v2.5 §2 greb 6 / F1b-2): emner fra Adversus' /v1/leads hver time i arbejdstiden (07–22 dansk tid) for aktive
// Adversus-integrationer med config.leads_v1 = true; om natten FULD indlæsning af alle emner i id-orden (cursor = sidste id, dataset leads_v1_fuld)
// indtil færdig (Codex F1b-2 P1: 90-dages backfill udelod ældre aktive emner og aktiveringsdagens tidlige timer).
// Eget vandmærke ('leads_v1'), filter lastUpdatedTime m. 2 t overlap (filterets virkning måles: uden_for_vindue), ALLE sider (ellers flyttes
// vandmærket ikke), lås pr. integration, tidsbudget mellem sider, budgetformål 'emner'. Kataloget styrer hvilke felter der skrives, og nye
// kampagnefelter oprettes automatisk i kataloget. Ingen rå payload gemmes.
// deno-lint-ignore-file no-explicit-any -- supabase-js/adapter er 3rd party
import { getAdapter } from "../adapters/registry.ts";
import { getSyncState, upsertSyncState, recordSyncError } from "../utils/sync-state.ts";
import { TimeoutGuard } from "../utils/timeout-guard.ts";
import { danskDato, erArbejdstid, inkrementeltVindue } from "./calls-incremental.ts";
import { forberedLeads, hentKampagnefeltDefinitioner, hentLeadsFuldSide, hentLeadsV1 } from "../../_shared/adversus-leads.ts";
import { hentKatalog } from "../../_shared/kald-felt-katalog.ts";
import { erBudgetFejl } from "../../_shared/adversus-budget.ts";

const LAAS_TTL_MS = 600 * 1000;
const UPSERT_BATCH = 500;
const FULD_SIDE = 1000;

type LogFn = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void;

async function laas(supabase: any, noegle: string, runId: string): Promise<boolean> {
  await supabase.from("provider_sync_locks").delete().lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("provider_sync_locks").insert({ provider: noegle, locked_at: new Date().toISOString(), locked_by: runId, expires_at: new Date(Date.now() + LAAS_TTL_MS).toISOString() });
  return !error;
}
async function frigivLaas(supabase: any, noegle: string, runId: string) { await supabase.from("provider_sync_locks").delete().eq("provider", noegle).eq("locked_by", runId); }

/** Skriver emner i bundter (idempotent upsert på integration + external_id). Returnerer antal skrevet og fejl. */
export async function skrivLeads(supabase: any, raekker: Record<string, unknown>[], log: LogFn): Promise<{ skrevet: number; fejl: number }> {
  let skrevet = 0, fejl = 0;
  for (let i = 0; i < raekker.length; i += UPSERT_BATCH) {
    const bundt = raekker.slice(i, i + UPSERT_BATCH);
    const { error } = await supabase.from("dialer_leads").upsert(bundt, { onConflict: "integration_id,external_id", ignoreDuplicates: false });
    if (error) { fejl += bundt.length; log("ERROR", `leads-incremental: upsert fejlede (${bundt.length} emner): ${error.message ?? error}`); } else skrevet += bundt.length;
  }
  return { skrevet, fejl };
}

export async function leadsIncremental(supabase: any, log: LogFn, opts: { integrationId?: string; tilstand?: "auto" | "inkrementel" | "nat"; budgetMs?: number } = {}) {
  const timer = new TimeoutGuard(opts.budgetMs ?? 120_000, 0.85);
  const stop = () => timer.isExpired();
  const nu = new Date();
  const tilstand = opts.tilstand && opts.tilstand !== "auto" ? opts.tilstand : (erArbejdstid(nu) ? "inkrementel" : "nat");
  let q = supabase.from("dialer_integrations").select("id, name, provider, api_url, config, calls_org_codes").eq("provider", "adversus").eq("is_active", true);
  if (opts.integrationId) q = q.eq("id", opts.integrationId);
  const { data: integrations, error } = await q;
  if (error) throw error;
  const valgte = (integrations ?? []).filter((i: any) => i?.config?.leads_v1 === true);
  const resultat: Record<string, unknown> = { tilstand, integrationer: valgte.length };
  if (valgte.length === 0) return resultat;
  const kat = await hentKatalog(supabase);  // emner kræver kataloget (fail-closed: ingen fallback-allowlist for emner)
  resultat.katalog_version = kat.version;
  const runId = `emner_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  for (const integ of valgte) {
    if (stop()) { resultat[integ.name] = { sprunget_over: "tidsbudget" }; continue; }
    const laasNoegle = `emner:${integ.id}`;
    if (!(await laas(supabase, laasNoegle, runId))) { resultat[integ.name] = { sprunget_over: "laast" }; continue; }
    let budgetVentet = 0;
    try {
      const { data: credentials } = await supabase.rpc("get_dialer_credentials", { p_integration_id: integ.id, p_encryption_key: Deno.env.get("DB_ENCRYPTION_KEY") });
      const adapter: any = await getAdapter("adversus", credentials, integ.name, integ.api_url, integ.config, integ.calls_org_codes);
      adapter.setBudgetFormaal?.("emner");
      const budget = { get ventet() { return Number(adapter.budgetVentet?.() ?? 0); } };
      const get = (sti: string) => adapter.getV1(sti) as Promise<unknown>;
      let defs: Promise<Map<number, { name: string; type: string }>> | null = null;
      const feltDefinitioner = () => (defs ??= hentKampagnefeltDefinitioner(get));
      const hentOgGem = async (fra: string, til: string) => {
        const { entries, sider, total, komplet, udenForVindue } = await hentLeadsV1(get, fra, til, { stop });
        if (!komplet) return { komplet: false, emner: 0, skrevet: 0, fejl: 0, sider, total, uden_for_vindue: udenForVindue, nye_katalogfelter: 0 };
        const { raekker, nyeKatalogfelter, kasseredeNoegler } = await forberedLeads(supabase, kat, entries, integ.id, feltDefinitioner);
        const r = raekker.length > 0 ? await skrivLeads(supabase, raekker, log) : { skrevet: 0, fejl: 0 };
        if (udenForVindue > 0) log("WARN", `leads-incremental ${integ.name}: ${udenForVindue} af ${entries.length} emner uden for vinduet – lastUpdatedTime-filteret virker ikke fuldt`);
        return { komplet: true, emner: entries.length, ...r, sider, total, uden_for_vindue: udenForVindue, nye_katalogfelter: nyeKatalogfelter, kasserede_noegler: kasseredeNoegler };
      };
      if (tilstand === "inkrementel") {
        const state = await getSyncState(supabase, integ.id, "leads_v1");
        const v = inkrementeltVindue(state?.last_success_at ? new Date(state.last_success_at) : null, nu);
        const r = await hentOgGem(v.fra.toISOString(), v.til.toISOString());
        if (r.komplet && r.fejl === 0) await upsertSyncState(supabase, integ.id, "leads_v1", v.til);
        else log("WARN", `leads-incremental ${integ.name}: vandmærke IKKE flyttet (komplet=${r.komplet}, fejl=${r.fejl})`);
        resultat[integ.name] = { vindue: [v.fra.toISOString(), v.til.toISOString()], efterslaeb: v.efterslaeb, ...r, ventet: budget.ventet };
      } else {
        // Nat: fuld indlæsning i id-orden, én side (1 request) ad gangen inden for tidsbudgettet; cursor = sidste id, 'faerdig' når en side ikke er fuld.
        const fuld = await getSyncState(supabase, integ.id, "leads_v1_fuld");
        let cursor: string | null = fuld?.cursor ?? null; let sider = 0; let emner = 0; let skrevet = 0; let fejl = 0; let nye = 0;
        if (cursor === "faerdig") { resultat[integ.name] = { fuld: "færdig", i_dag: danskDato(nu), ventet: budget.ventet }; }
        else {
          let fraId = Number(cursor ?? 0); if (!Number.isFinite(fraId)) fraId = 0;
          while (!stop()) {
            const side = await hentLeadsFuldSide(get, fraId, FULD_SIDE);
            sider++; emner += side.entries.length;
            if (side.entries.length > 0) {
              const { raekker, nyeKatalogfelter } = await forberedLeads(supabase, kat, side.entries, integ.id, feltDefinitioner);
              nye += nyeKatalogfelter;
              const r = raekker.length > 0 ? await skrivLeads(supabase, raekker, log) : { skrevet: 0, fejl: 0 };
              skrevet += r.skrevet; fejl += r.fejl;
              if (r.fejl > 0) { await recordSyncError(supabase, integ.id, "leads_v1_fuld", `upsert-fejl efter id ${fraId}`); break; }  // cursor flyttes ikke over fejl
            }
            fraId = side.sidsteId; cursor = side.faerdig ? "faerdig" : String(fraId);
            await upsertSyncState(supabase, integ.id, "leads_v1_fuld", nu, cursor);
            if (side.faerdig) break;
          }
          resultat[integ.name] = { fuld: cursor === "faerdig" ? "færdig nu" : { cursor, sider, emner, skrevet, fejl, nye_katalogfelter: nye }, i_dag: danskDato(nu), ventet: budget.ventet };
        }
      }
      budgetVentet = budget.ventet;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(erBudgetFejl(e) ? "WARN" : "ERROR", `leads-incremental ${integ.name}: ${msg}`);
      await recordSyncError(supabase, integ.id, tilstand === "inkrementel" ? "leads_v1" : "leads_v1_fuld", msg);
      resultat[integ.name] = { fejl: msg, ventet: budgetVentet };
    } finally {
      await frigivLaas(supabase, laasNoegle, runId);
    }
  }
  return resultat;
}
