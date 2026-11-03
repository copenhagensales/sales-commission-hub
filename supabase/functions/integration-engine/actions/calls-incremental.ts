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
import { hentCallsV1, mapCallEntry } from "../../_shared/adversus-calls.ts";
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

/** Alle Adversus-brugere (også uden e-mail – fetchUsers springer dem over) som Map<id, {navn, email, aktiv}>; sider à 1000. */
export async function hentBrugereV1(get: (sti: string) => Promise<unknown>, maksSider = 5): Promise<Map<string, { navn: string | null; email: string | null; aktiv: boolean | null }>> {
  const m = new Map<string, { navn: string | null; email: string | null; aktiv: boolean | null }>();
  for (let side = 1; side <= maksSider; side++) {
    const data = (await get(`/users?pageSize=1000&page=${side}&includeMeta=true`)) as { users?: unknown; meta?: { pagination?: { pageCount?: unknown } } } | null;
    const users = Array.isArray(data?.users) ? (data!.users as Record<string, unknown>[]) : [];
    for (const u of users) {
      const id = u.id === null || u.id === undefined ? "" : String(u.id);
      if (!id) continue;
      const navn = (u.displayName ?? u.name) as string | undefined;
      const email = typeof u.email === "string" && u.email.trim() ? u.email.trim() : null;
      m.set(id, { navn: navn ? String(navn) : null, email, aktiv: typeof u.active === "boolean" ? u.active : null });
    }
    const pageCount = Number(data?.meta?.pagination?.pageCount);
    if (!Number.isFinite(pageCount) || side >= pageCount || users.length === 0) break;
  }
  return m;
}

/** [krav 11] E-mailens domæne hører til kontoens egne domæner? null = ingen e-mail (afgøres manuelt). */
export function domaeneOk(email: string | null | undefined, egneDomaener: string[]): boolean | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e.includes("@")) return null;
  return egneDomaener.map((d) => d.toLowerCase()).includes(e.split("@")[1]);
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
  // Fase 2 (Codex r8): bagud-hentning for nyligt tilladte brugere kører først, når ALLE kontis normale hentning er færdig – budgettet deles mellem konti
  type BagudKoe = { integ: any; kontoId: string; brugerIds: string[]; laasNoegle: string; hentOgGem: (fra: string, til: string, ids?: string[]) => Promise<{ komplet: boolean; errors: number }> };
  const bagudKoe: BagudKoe[] = [];
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
      // [F1a-3 krav 10] Kontoens indstilling »kun egne medarbejderes kald«: Adversus bedes KUN om koblede bruger-id'er (filter userId).
      // Uden listen må der ikke hentes bredt (fejl → kørslen fejler for kontoen). Ingen koblede → intet hentes.
      const { data: konto, error: kontoErr } = await supabase.from("api_konto").select("id, kun_egne_medarbejdere, egne_domaener").eq("integration_id", integ.id).maybeSingle();
      if (kontoErr) throw kontoErr;
      // Ingen kontorække = indstillingen kan ikke læses → der må IKKE hentes (Codex r4). Rækken oprettes af trigger for enhver integration (F1b-3).
      if (!konto?.id) throw new Error("api_konto mangler for integrationen – kaldshentning stoppet (krav 10: indstillingen »kun egne medarbejdere« kan ikke læses)");
      const kontoId: string = konto.id;
      const kunEgne = konto.kun_egne_medarbejdere === true;
      const egneDomaener: string[] = Array.isArray(konto.egne_domaener) ? (konto.egne_domaener as string[]) : [];
      // Tilladte bruger-id'er på DENNE konto = agent_alias_tilladt(konto) i databasen (ENE definition, krav 11: koblet ELLER e-mail i eget domæne, ikke »ikke vores«).
      // Læses igen før lagring, så et »ikke vores« valgt undervejs respekteres (Codex r4).
      const hentTilladte = async (): Promise<string[]> => {
        const { data: tilladte, error: kErr } = await supabase.rpc("agent_alias_tilladt", { p_konto: kontoId });
        if (kErr) throw kErr;
        return ((tilladte ?? []) as (string | { agent_alias_tilladt: string })[]).map((t) => (typeof t === "string" ? t : t.agent_alias_tilladt));
      };
      let brugerIds: string[] | undefined;  // sættes efter brugerregistrering/navngivning nedenfor (krav 11, Codex r6: nye brugere skal kendes FØR filtrering)
      // [F1a-5] Sletteregel-port (fast regel, Mathias 3/11): kun kampagner med en gældende sletteregel hentes – for ALLE konti. Tom liste = intet hentes.
      // Listen genlæses før lagring (en regel kan være fjernet undervejs). Fejl i opslaget → kørslen fejler for kontoen (der må ikke hentes bredt).
      const hentKampagnerMedRegel = async (): Promise<string[]> => {
        const { data, error } = await supabase.rpc("kald_kampagne_regler");
        if (error) throw error;
        return ((data ?? []) as { kampagne_ekstern_id: string }[]).map((r) => String(r.kampagne_ekstern_id));
      };
      const kampagneIds: string[] = await hentKampagnerMedRegel();
      if (kampagneIds.length === 0) log("WARN", `calls-incremental ${integ.name}: ingen kampagner med sletteregel – intet hentes`);
      let filterBrudt = false;
      const hentOgGem = async (fra: string, til: string, ids: string[] | undefined = brugerIds): Promise<{ komplet: boolean; processed: number; errors: number; sider: number; total: number | null; frasorteret?: number }> => {
        const hentet = await hentCallsV1(get, fra, til, { stop, brugerIds: ids, kampagneIds });
        let { entries } = hentet; const { sider, total, komplet, filterRespekteret } = hentet; let frasorteret = hentet.frasorteret;
        if (filterRespekteret === false && !filterBrudt) { filterBrudt = true; log("WARN", `calls-incremental ${integ.name}: Adversus respekterede ikke userId/campaignId-filteret – ${frasorteret} kald frasorteret før lagring`); }
        if (entries.length > 0) {  // genkontrol mod de aktuelle lister (valg i UI under hentningen): kampagner med regel + (kun egne) tilladte brugere
          const nuKamp = new Set(await hentKampagnerMedRegel());
          const nuTilladt = kunEgne ? new Set(await hentTilladte()) : null;
          const foer = entries.length; entries = entries.filter((e) => nuKamp.has(String(e.campaignId ?? "")) && (!nuTilladt || nuTilladt.has(String(e.userId ?? ""))));
          frasorteret += foer - entries.length;
        }
        if (!komplet) return { komplet: false, processed: 0, errors: 0, sider, total, frasorteret };
        const calls = entries.map((e) => mapCallEntry(e, integ.name));
        const r: any = calls.length > 0 ? await engine.processCalls(calls, integ.id) : { processed: 0, errors: 0 };
        return { komplet: true, processed: Number(r.processed ?? 0), errors: Number(r.errors ?? 0), sider, total, frasorteret };
      };
      // [F1a-3] Sælger-alias fra Adversus /users: ukendte bruger-id'er (agent_id null, intet navn) får navn/e-mail, og e-mail kobler til agenten.
      // Kører FØR hentningen (Codex r6), så nye brugere er kendt, inden tilladelseslisten dannes. Én person kan have flere Adversus-brugere, derfor alias frem for agents.
      try {
        let brugereCache: Awaited<ReturnType<typeof hentBrugereV1>> | null = null;
        const hentBrugere = async () => brugereCache ?? (brugereCache = await hentBrugereV1(get));
        // [krav 10/11] Om natten: ALLE kontoens brugere registreres som alias (uden navn → navngives/klassificeres nedenfor), så listen er klar FØR
        // »kun egne« slås til, og fremmede brugere dukker op selv om userId-filteret holder deres kald ude.
        // Registrering: om natten altid; i arbejdstid på »kun egne«-konti hver time (1 request), så en ny medarbejder højst venter en time på at blive hentet
        const usersState = kunEgne && tilstand === "inkrementel" ? await getSyncState(supabase, integ.id, "users_v1") : null;
        const usersGammel = !usersState?.last_success_at || (nu.getTime() - new Date(usersState.last_success_at).getTime()) > 60 * 60 * 1000;
        if ((tilstand !== "inkrementel" || (kunEgne && usersGammel)) && !stop()) {
          const alle = await hentBrugere();
          const raekker = [...alle.keys()].map((id) => ({ kilde: "adversus", ekstern_id: id, oprindelse: "brugere", konto_id: kontoId }));
          if (raekker.length > 0) {
            const { error } = await supabase.from("agent_ekstern_alias").upsert(raekker, { onConflict: "kilde,ekstern_id", ignoreDuplicates: true });
            if (error) log("WARN", `agent_ekstern_alias: kunne ikke registrere kontoens ${raekker.length} brugere: ${error.message}`);
            // Rækker uden konto (fx seedet fra salg), som er brugere på denne konto, hører til her (bruger-id'er er globale hos Adversus – målt 2/11)
            const { error: e2 } = await supabase.from("agent_ekstern_alias").update({ konto_id: kontoId }).eq("kilde", "adversus").is("konto_id", null).in("ekstern_id", [...alle.keys()].slice(0, 500));
            if (e2) log("WARN", `agent_ekstern_alias: kunne ikke sætte konto på eksisterende rækker: ${e2.message}`);
          }
          resultat[`${integ.name}_brugere_registreret`] = raekker.length;
          await upsertSyncState(supabase, integ.id, "users_v1", nu);
        }
        const { data: ukendte } = await supabase.from("agent_ekstern_alias").select("ekstern_id").eq("kilde", "adversus").is("agent_id", null).eq("ikke_vores", false).is("navn", null).limit(200);
        if ((ukendte ?? []).length > 0) {
          const brugere = await hentBrugere();
          const { data: agenter } = await supabase.from("agents").select("id, email, external_adversus_id, external_dialer_id");
          // Kun ENTYDIGE e-mails kobler automatisk (Codex r1: fælles/genbrugte postkasser → manuel afklaring); agents' eksterne id kobler direkte
          const antalPrEmail = new Map<string, number>(); const agentAfEmail = new Map<string, string>(); const agentAfEkstId = new Map<string, string>();
          for (const a of (agenter ?? []) as { id: string; email: string | null; external_adversus_id: string | null; external_dialer_id: string | null }[]) {
            if (a.email) { const e = a.email.toLowerCase(); antalPrEmail.set(e, (antalPrEmail.get(e) ?? 0) + 1); agentAfEmail.set(e, a.id); }
            if (a.external_adversus_id) agentAfEkstId.set(String(a.external_adversus_id), a.id);
            if (a.external_dialer_id) agentAfEkstId.set(String(a.external_dialer_id), a.id);
          }
          let opdateret = 0, koblet = 0, tvetydige = 0, fremmede = 0;
          for (const u of ukendte as { ekstern_id: string }[]) {
            const b = brugere.get(u.ekstern_id);
            if (!b) continue;
            const e = b.email?.toLowerCase() ?? null;
            const entydig = e ? (antalPrEmail.get(e) ?? 0) === 1 : false;
            if (e && !entydig && (antalPrEmail.get(e) ?? 0) > 1) tvetydige++;
            const agentId = agentAfEkstId.get(u.ekstern_id) ?? (entydig ? agentAfEmail.get(e!) ?? null : null);
            // [krav 11] fremmed domæne (e-mail uden for kontoens egne domæner) og ingen kobling → automatisk »ikke vores« (manuelle valg er ikke i 'ukendte')
            const ikkeVores = !agentId && domaeneOk(e, egneDomaener) === false;
            if (ikkeVores) fremmede++;
            // Betingelserne gentages i skrivningen (Codex r6): et manuelt valg truffet efter læsningen må ikke overskrives
            const { error } = await supabase.from("agent_ekstern_alias").update({ navn: b.navn, email: b.email, aktiv: b.aktiv, agent_id: agentId, ...(ikkeVores ? { ikke_vores: true } : {}), oprindelse: "brugere", aendret: new Date().toISOString() })
              .eq("kilde", "adversus").eq("ekstern_id", u.ekstern_id).is("agent_id", null).eq("ikke_vores", false).neq("oprindelse", "manuel");
            if (!error) { opdateret++; if (agentId) koblet++; }
          }
          resultat[`${integ.name}_brugere`] = { ukendte: ukendte!.length, navngivet: opdateret, koblet: koblet, tvetydige, fremmede_domaener: fremmede };
        }
        // [krav 11] Reklassificering ved domæneændring (Codex r6 P2): automatisk klassificerede brugere (oprindelse 'brugere', ingen medarbejder) følger kontoens aktuelle domæner
        const { data: auto } = await supabase.from("agent_ekstern_alias").select("ekstern_id, email, ikke_vores").eq("kilde", "adversus").eq("konto_id", kontoId).eq("oprindelse", "brugere").is("agent_id", null).not("email", "is", null);
        let omklassificeret = 0;
        for (const r of (auto ?? []) as { ekstern_id: string; email: string; ikke_vores: boolean }[]) {
          const skalVaereIkkeVores = domaeneOk(r.email, egneDomaener) === false;
          if (skalVaereIkkeVores === r.ikke_vores) continue;
          const { error } = await supabase.from("agent_ekstern_alias").update({ ikke_vores: skalVaereIkkeVores, aendret: new Date().toISOString() }).eq("kilde", "adversus").eq("ekstern_id", r.ekstern_id).eq("oprindelse", "brugere").is("agent_id", null);
          if (!error) omklassificeret++;
        }
        if (omklassificeret > 0) resultat[`${integ.name}_omklassificeret`] = omklassificeret;
        brugerIds = kunEgne ? await hentTilladte() : undefined;
        // Reparation (Codex r1 P2 / r2): koblinger med agent, der endnu ikke er anvendt på kald (anvendt_tid null – fra /users ovenfor, fra UI, eller
        // et tidligere fejlet forsøg) → ét idempotent kald, uafhængigt af om der var ukendte id'er i denne kørsel.
        const { data: uanvendt } = await supabase.from("agent_ekstern_alias").select("ekstern_id").eq("kilde", "adversus").not("agent_id", "is", null).is("anvendt_tid", null).limit(1);
        if ((uanvendt ?? []).length > 0) {
          const { data: repareret, error: rErr } = await supabase.rpc("agent_alias_anvend_alle", { p_kilde: "adversus" });
          if (rErr) log("WARN", `agent_alias_anvend_alle fejlede: ${rErr.message}`);
          else resultat[`${integ.name}_alias_anvendt`] = { kald_repareret: Number(repareret ?? 0) };
        }
      } catch (e) { log("WARN", `calls-incremental ${integ.name}: alias/users-opslag fejlede: ${e instanceof Error ? e.message : String(e)}`); }
      if (kunEgne && brugerIds === undefined) brugerIds = await hentTilladte();  // alias-trinnet fejlede før listen blev dannet → dan den nu (ellers kastes, og der hentes ikke)
      if (tilstand === "inkrementel") {
        const state = await getSyncState(supabase, integ.id, "calls_v1");
        const v = inkrementeltVindue(state?.last_success_at ? new Date(state.last_success_at) : null, nu);
        const r = await hentOgGem(v.fra.toISOString(), v.til.toISOString());
        if (r.komplet && r.errors === 0) await upsertSyncState(supabase, integ.id, "calls_v1", v.til);
        else log("WARN", `calls-incremental ${integ.name}: vandmærke IKKE flyttet (komplet=${r.komplet}, fejl=${r.errors})`);
        resultat[integ.name] = { vindue: [v.fra.toISOString(), v.til.toISOString()], efterslaeb: v.efterslaeb, ...r, ventet: budget.ventet, kampagner_i_filter: kampagneIds.length, ...(kunEgne ? { kun_egne: true, brugere_i_filter: brugerIds?.length ?? 0 } : {}) };
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
      if (kunEgne && (brugerIds?.length ?? 0) > 0) bagudKoe.push({ integ, kontoId, brugerIds: brugerIds!, laasNoegle, hentOgGem });
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
  // Fase 2: bagud-hentning (genoptagelig dag for dag; cursor i dialer_sync_state 'calls_v1_bagud:<id>'; starter ved i dag). Låsen tages igen pr. konto.
  for (const k of bagudKoe) {
    if (stop()) break;
    if (!(await laas(supabase, k.laasNoegle, runId))) continue;
    try {
      const { data: nye } = await supabase.from("agent_ekstern_alias").select("ekstern_id, aendret").eq("kilde", "adversus").eq("konto_id", k.kontoId).in("ekstern_id", k.brugerIds).is("bagud_hentet_tid", null).limit(tilstand === "inkrementel" ? 1 : 3);
      const bagud: unknown[] = [];
      for (const n of (nye ?? []) as { ekstern_id: string; aendret: string }[]) {
        if (stop()) break;
        const bfDage = Number(k.integ?.config?.calls_v1_backfill_dage ?? 30);
        const ds = `calls_v1_bagud:${n.ekstern_id}`;
        const st = await getSyncState(supabase, k.integ.id, ds);
        const frisk = `${danskDato(nu)}|${plusDage(danskDato(nu), -bfDage)}`;
        let cursor: string | null = st?.cursor ?? frisk;
        // Codex r8: en gammel 'faerdig' fra før aliasændringen (fx »ikke vores« → tilladt igen) gælder ikke – start forfra, så fravalgsperioden hentes
        if (cursor === "faerdig" && st?.last_success_at && new Date(st.last_success_at).getTime() < new Date(n.aendret).getTime()) cursor = frisk;
        let dageKoert = 0; let fejl: unknown = null;
        while (cursor !== "faerdig" && !stop()) {
          const b = backfillDag(cursor, bfDage, nu);
          if (!b) { cursor = "faerdig"; break; }
          const r = await k.hentOgGem(b.fra, b.til, [n.ekstern_id]);
          if (!r.komplet || r.errors > 0) { fejl = { dag: b.dag, komplet: r.komplet, fejl: r.errors }; break; }
          cursor = b.naeste; dageKoert++;
          await upsertSyncState(supabase, k.integ.id, ds, nu, cursor);
        }
        if (cursor === "faerdig") {
          await upsertSyncState(supabase, k.integ.id, ds, nu, "faerdig");
          // Markeres kun, hvis rækken er uændret siden start (en omkobling i UI undervejs nulstiller og får en ny vurdering)
          await supabase.from("agent_ekstern_alias").update({ bagud_hentet_tid: new Date().toISOString() }).eq("kilde", "adversus").eq("ekstern_id", n.ekstern_id).eq("aendret", n.aendret).is("bagud_hentet_tid", null);
        }
        bagud.push({ bruger: n.ekstern_id, dage_koert: dageKoert, cursor, ...(fejl ? { fejl } : {}) });
      }
      if (bagud.length > 0) resultat[`${k.integ.name}_bagud`] = bagud;
    } catch (e) { log("WARN", `calls-incremental ${k.integ.name}: bagud-hentning fejlede: ${e instanceof Error ? e.message : String(e)}`); }
    finally { await frigivLaas(supabase, k.laasNoegle, runId); }
  }
  return resultat;
}
