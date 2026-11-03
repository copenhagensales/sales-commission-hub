// Fælles sink for dialer-sessions (B1, fase0/samtaler/b1-enreach-kaldsdata-krav.md). Skriver StandardSession[] til dialer_sessions.
// Deles af integration-engine (polling) og enreach-hook (push), så porten, alias og kataloget er de samme uanset vej (krav 14).
// Enreach-konti på den nye vej (dialer_integrations.config.sessions_v1 = true) får: (1) sletteregel-port – kun kampagner med regel lagres (fail-closed),
// (2) kun egne medarbejdere – kun sessions fra tilladte bruger-id'er (agent_alias_tilladt), (3) kataloget afgør kolonner/metadata, (4) sælger via alias.
// Konti uden flag opfører sig som hidtil (ingen adfærdsændring før aktivering). Ukendte kampagner registreres ALTID som »ikke koblet« (trin 2.1), før porten.
import { anvendKatalog, hentKatalog, type Katalog } from "./kald-felt-katalog.ts";

export interface SessionDto {
  externalId: string;
  integrationType: "adversus" | "enreach" | "other";
  dialerName: string;
  leadExternalId?: string;
  agentExternalId?: string;
  campaignExternalId?: string;
  status: string;
  startTime?: string;
  endTime?: string;
  sessionSeconds?: number;
  hasCdr?: boolean;
  cdrDurationSeconds?: number;
  cdrDisposition?: string;
  metadata?: Record<string, unknown>;
}
export type LogFn = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void;
export interface SinkResultat { processed: number; errors: number; matched: number; duplicates: number; uden_regel?: number; uden_tilladelse?: number; kampagner_registreret?: number; port?: boolean }

const lav = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim().toLowerCase());
export function chunk<T>(arr: T[], n: number): T[][] { const ud: T[][] = []; for (let i = 0; i < arr.length; i += n) ud.push(arr.slice(i, i + n)); return ud; }

/** Port (krav 1): kun sessions for kampagner med gældende sletteregel. */
export function delMedRegel<T extends { campaignExternalId?: string }>(sessions: T[], regler: Set<string>): { med: T[]; uden: number } {
  const med = sessions.filter((s) => !!s.campaignExternalId && regler.has(String(s.campaignExternalId)));
  return { med, uden: sessions.length - med.length };
}
/** Kun egne (krav 3): kun sessions med et tilladt bruger-id; sessions uden bruger-id frasorteres (fail-closed – emnet er ikke behandlet af en af vores). */
export function delTilladte<T extends { agentExternalId?: string }>(sessions: T[], tilladte: Set<string>): { med: T[]; uden: number } {
  const med = sessions.filter((s) => !!s.agentExternalId && tilladte.has(lav(s.agentExternalId)));
  return { med, uden: sessions.length - med.length };
}
/** Kampagner, hentningen har set (id + navn) – registreres som »ikke koblet«, hvis de er ukendte. */
export function kampagneRaekker(sessions: SessionDto[]): { adversus_campaign_id: string; adversus_campaign_name: string; client_campaign_id: null }[] {
  const m = new Map<string, string>();
  for (const s of sessions) {
    const id = String(s.campaignExternalId ?? "").trim(); if (!id) continue;
    const navn = String(s.metadata?.campaignName ?? "").trim();
    if (!m.has(id) || (navn && !m.get(id))) m.set(id, navn);
  }
  return [...m.entries()].map(([id, navn]) => ({ adversus_campaign_id: id, adversus_campaign_name: navn || id, client_campaign_id: null }));
}
/** Sælger: alias (kilde + bruger-id) først, derefter agents' eksterne id'er/e-mail som hidtil. */
export function findAgent(agentExternalId: string | undefined, alias: Map<string, string>, extId: Map<string, string>, dialerId: Map<string, string>, email: Map<string, string>): string | null {
  if (!agentExternalId) return null;
  return alias.get(lav(agentExternalId)) ?? extId.get(agentExternalId) ?? dialerId.get(agentExternalId) ?? email.get(lav(agentExternalId)) ?? null;
}

async function alleAgenter(supabase: any): Promise<{ id: string; external_adversus_id: string | null; external_dialer_id: string | null; email: string | null }[]> {
  const ud: any[] = []; const side = 1000;
  for (let fra = 0; ; fra += side) {
    const { data, error } = await supabase.from("agents").select("id, external_adversus_id, external_dialer_id, email").range(fra, fra + side - 1);
    if (error) throw error;
    ud.push(...(data ?? [])); if (!data || data.length < side) break;
  }
  return ud;
}

export async function processSessionsSink(supabase: any, sessions: SessionDto[], integrationId: string, batchSize: number, log: LogFn): Promise<SinkResultat> {
  if (sessions.length === 0) return { processed: 0, errors: 0, matched: 0, duplicates: 0 };
  log("INFO", `Processing ${sessions.length} sessions for integration ${integrationId} in batches of ${batchSize}...`);

  // Konto og vej
  const { data: integ, error: iErr } = await supabase.from("dialer_integrations").select("id, name, provider, config").eq("id", integrationId).maybeSingle();
  if (iErr || !integ) { log("ERROR", `sessions: integrationen kunne ikke læses – intet lagres: ${iErr?.message ?? "ukendt"}`); return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0 }; }
  const provider = String(integ.provider ?? "");
  const nyVej = integ.config?.sessions_v1 === true;
  const { data: konto, error: kErr } = await supabase.from("api_konto").select("id, kun_egne_medarbejdere, egne_domaener").eq("integration_id", integrationId).maybeSingle();
  // Fail-closed (Codex r1): på den nye vej er kontoen en forudsætning for porten – kan den ikke læses, lagres intet i denne kørsel
  if (nyVej && (kErr || !konto?.id)) { log("ERROR", `sletteregel-port: api_konto kunne ikke læses for ${integ.name} – intet lagres: ${kErr?.message ?? "mangler"}`); return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0, port: true }; }
  const kilde = provider === "enreach" ? "enreach" : "adversus";
  let udenRegel = 0, udenTilladelse = 0, kampagnerRegistreret = 0;
  let liste = sessions;

  // Ukendte kampagner registreres FØR porten (ellers ses de aldrig på Sletteregler-fanen)
  if (provider === "enreach") {
    try {
      const raekker = kampagneRaekker(sessions);
      if (raekker.length > 0) {
        const { data: kendte } = await supabase.from("adversus_campaign_mappings").select("adversus_campaign_id").in("adversus_campaign_id", raekker.map((r) => r.adversus_campaign_id));
        const kendt = new Set(((kendte ?? []) as { adversus_campaign_id: string }[]).map((k) => k.adversus_campaign_id));
        const nye = raekker.filter((r) => !kendt.has(r.adversus_campaign_id));
        if (nye.length > 0) {
          const { error } = await supabase.from("adversus_campaign_mappings").upsert(nye, { onConflict: "adversus_campaign_id", ignoreDuplicates: true });
          if (error) log("WARN", `kampagneregistrering fejlede: ${error.message}`); else { kampagnerRegistreret = nye.length; log("INFO", `sletteregel-port: ${nye.length} ukendte kampagner registreret som »ikke koblet« (vises på Sletteregler-fanen)`); }
        }
      }
    } catch (e) { log("WARN", `kampagneregistrering: ${e instanceof Error ? e.message : String(e)}`); }
  }

  // Ukendte bruger-id'er → alias »uden kobling« for ALLE Enreach-konti (så kontoens sælgere kan afgøres og dækningskontrollen køres FØR aktivering – også hvor /users er lukket, fx ase).
  // Et id, der selv er en e-mail (HeroBase orgCode for CS-brugere), får e-mailen sat, så domæneregel og automatisk kobling virker uden /users. På den nye vej er en registreringsfejl fail-closed (Codex r2).
  if (provider === "enreach" && konto?.id) {
    const set = new Set(liste.map((s) => lav(s.agentExternalId)).filter(Boolean));
    if (set.size > 0) {
      const { data: findes, error: fErr } = await supabase.from("agent_ekstern_alias").select("ekstern_id").eq("kilde", kilde).in("ekstern_id", [...set].slice(0, 1000));
      const kendt = new Set(((findes ?? []) as { ekstern_id: string }[]).map((f) => f.ekstern_id));
      const nye = fErr ? [] : [...set].filter((id) => !kendt.has(id)).map((id) => ({ kilde, ekstern_id: id, konto_id: konto.id, oprindelse: "kald", email: id.includes("@") ? id : null }));
      const { error } = nye.length > 0 ? await supabase.from("agent_ekstern_alias").upsert(nye, { onConflict: "kilde,ekstern_id", ignoreDuplicates: true }) : { error: fErr };
      if (error) {
        if (nyVej) { log("ERROR", `alias: ukendte bruger-id'er kunne ikke registreres – intet lagres (vandmærket står): ${error.message}`); return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0, port: true }; }
        log("WARN", `alias: ukendte bruger-id'er kunne ikke registreres: ${error.message}`);
      } else if (nye.length > 0) log("INFO", `alias: ${nye.length} ukendte bruger-id'er registreret som »uden kobling«`);
    }
  }

  // Alias-kort – KUN på den nye vej (konti uden flag opfører sig som hidtil: agents' eksterne id'er). Enreach-brugere er org-globale (tryg+alka deler brugere) → alias pr. kilde, ikke pr. konto.
  const aliasMap = new Map<string, string>();
  if (nyVej && provider === "enreach") {
    const { data: al, error } = await supabase.from("agent_ekstern_alias").select("ekstern_id, agent_id").eq("kilde", kilde).not("agent_id", "is", null).limit(5000);
    if (error) { log("ERROR", `alias kunne ikke læses – intet lagres: ${error.message}`); return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0, port: true }; }
    for (const a of (al ?? []) as { ekstern_id: string; agent_id: string | null }[]) if (a.agent_id) aliasMap.set(lav(a.ekstern_id), a.agent_id);
  }

  if (nyVej && provider === "enreach") {
    // (1) Sletteregel-port – fail-closed
    try {
      const { data: regler, error } = await supabase.rpc("kald_kampagne_regler");
      if (error) throw error;
      const ok = new Set(((regler ?? []) as { kampagne_ekstern_id: string }[]).map((r) => String(r.kampagne_ekstern_id)));
      const r = delMedRegel(liste, ok); liste = r.med; udenRegel = r.uden;
      if (udenRegel > 0) log("WARN", `sletteregel-port: ${udenRegel} sessions fra kampagner uden sletteregel lagres ikke`);
    } catch (e) {
      log("ERROR", `sletteregel-port: kampagneregler kunne ikke læses – intet lagres: ${e instanceof Error ? e.message : String(e)}`);
      return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0, port: true };
    }
    // (2) Kun egne: kun tilladte bruger-id'er lagres (ukendte id'er er registreret ovenfor – fejlede det, er kørslen allerede afbrudt)
    if (konto?.id) {
      try {
        if (konto.kun_egne_medarbejdere) {
          const { data: till, error } = await supabase.rpc("agent_alias_tilladt", { p_konto: konto.id });
          if (error) throw error;
          const tilladte = new Set(((till ?? []) as ({ agent_alias_tilladt?: string } | string)[]).map((t) => lav(typeof t === "string" ? t : t.agent_alias_tilladt)));
          const r = delTilladte(liste, tilladte); liste = r.med; udenTilladelse = r.uden;
          if (udenTilladelse > 0) log("WARN", `kun egne medarbejdere: ${udenTilladelse} sessions fra ikke-tilladte/ukendte bruger-id'er lagres ikke`);
        }
      } catch (e) {
        log("ERROR", `kun egne medarbejdere: tilladelsesliste kunne ikke dannes – intet lagres: ${e instanceof Error ? e.message : String(e)}`);
        return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0, uden_regel: udenRegel, port: true };
      }
    }
  }
  if (liste.length === 0) return { processed: 0, errors: 0, matched: 0, duplicates: 0, uden_regel: udenRegel, uden_tilladelse: udenTilladelse, kampagner_registreret: kampagnerRegistreret, port: nyVej };

  // Katalog: på den nye vej er kataloget en forudsætning (fail-closed, Codex r1); uden flag skrives som hidtil
  let katalog: Katalog | null = null;
  if (nyVej) {
    try { katalog = await hentKatalog(supabase); if (!katalog.raekker.some((r) => r.kilde === kilde && r.maal_tabel === "dialer_sessions" && r.status === "aktiv" && r.hentes)) throw new Error(`ingen aktive katalogrækker for ${kilde} → dialer_sessions`); }
    catch (e) { log("ERROR", `feltkatalog utilgængeligt – intet lagres: ${e instanceof Error ? e.message : String(e)}`); return { processed: 0, errors: sessions.length, matched: 0, duplicates: 0, port: true }; }
  }

  const agents = await alleAgenter(supabase);
  // Legacy (uden flag): som før – eksternt id → dialer-id, sidste vinder ved dubletter. Ny vej: kun ENTYDIGE nøgler (§10: ingen gæt) + e-mail.
  const entydig = (par: [string, string][]): Map<string, string> => { const n = new Map<string, number>(); for (const [k] of par) n.set(k, (n.get(k) ?? 0) + 1); return new Map(par.filter(([k]) => n.get(k) === 1)); };
  const parExt: [string, string][] = agents.filter((a) => a.external_adversus_id && a.id).map((a) => [a.external_adversus_id as string, a.id]);
  const parDialer: [string, string][] = agents.filter((a) => a.external_dialer_id && a.id).map((a) => [a.external_dialer_id as string, a.id]);
  const parEmail: [string, string][] = agents.filter((a) => a.email && a.id).map((a) => [lav(a.email), a.id]);
  const agentMapByExtId = nyVej ? entydig(parExt) : new Map(parExt);
  const agentMapByDialerId = nyVej ? entydig(parDialer) : new Map(parDialer);
  const agentMapByEmail = nyVej ? entydig(parEmail) : new Map<string, string>();  // legacy brugte aldrig e-mail

  let totalProcessed = 0, totalErrors = 0, totalMatched = 0;
  for (const [batchNum, batch] of chunk(liste, batchSize).entries()) {
    const rows: Record<string, unknown>[] = []; let batchMatched = 0;
    for (const session of batch) {
      try {
        const agentId = findAgent(session.agentExternalId, aliasMap, agentMapByExtId, agentMapByDialerId, agentMapByEmail);
        if (agentId) batchMatched++;
        const raa: Record<string, unknown> = {
          integration_id: integrationId, external_id: session.externalId, lead_external_id: session.leadExternalId || null, agent_external_id: session.agentExternalId || null,
          campaign_external_id: session.campaignExternalId || null, status: session.status, start_time: session.startTime || null, end_time: session.endTime || null,
          session_seconds: session.sessionSeconds || null, has_cdr: session.hasCdr || false, cdr_duration_seconds: session.cdrDurationSeconds || null, cdr_disposition: session.cdrDisposition || null,
          source: session.integrationType || "adversus", metadata: { ...(session.metadata || {}), agent_id: agentId, dialer_name: session.dialerName }, updated_at: new Date().toISOString(),
        };
        if (katalog) { const r = anvendKatalog(katalog, "dialer_sessions", kilde, raa).raekke as Record<string, unknown>; delete r.katalog_version; rows.push(r); } else rows.push(raa);
      } catch (e) { totalErrors++; log("ERROR", `Error preparing session ${session.externalId}: ${e instanceof Error ? e.message : String(e)}`); }
    }
    if (rows.length === 0) continue;
    const { error } = await supabase.from("dialer_sessions").upsert(rows, { onConflict: "integration_id,external_id", ignoreDuplicates: false });
    if (error) { totalErrors += rows.length; log("ERROR", `Error upserting session batch ${batchNum + 1}: ${error.message}`); continue; }
    totalProcessed += rows.length; totalMatched += batchMatched;
    log("INFO", `Session batch ${batchNum + 1} complete: ${rows.length} upserted, ${batchMatched} agent-matched`);
  }
  const statusCounts: Record<string, number> = {}; for (const s of liste) statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
  log("INFO", `Session status distribution: ${JSON.stringify(statusCounts)}`);
  return { processed: totalProcessed, errors: totalErrors, matched: totalMatched, duplicates: 0, uden_regel: udenRegel, uden_tilladelse: udenTilladelse, kampagner_registreret: kampagnerRegistreret, port: nyVej };
}
