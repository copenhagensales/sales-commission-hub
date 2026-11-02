import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardCall } from "../types.ts"
import { chunk, fetchAllPaginated } from "../utils/batch.ts"
import { sanitizeDialerCallMetadata } from "../../_shared/dialer-call-privacy.ts"
import { anvendKatalog, harKilde, hentKatalog, kildeForIntegrationType, type Katalog } from "../../_shared/kald-felt-katalog.ts"


/**
 * List of email domains that should be excluded from syncing.
 * These are internal/partner accounts that shouldn't be visible to users.
 */
const EXCLUDED_EMAIL_DOMAINS = [
  "@relatel.dk",
  "@ps-marketing.dk",
  "@finansforbundet.dk",
  "@straightlineagency.dk",
  "@staightlineagency.dk",
  "@tele-part.dk",
  "@aogtil.dk",
  "@ase.dk",
];

function isExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return EXCLUDED_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}


async function processCallsBatch(
  supabase: SupabaseClient,
  calls: StandardCall[],
  agentMapByExtId: Map<string, string>,
  agentMapByEmail: Map<string, string>,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void,
  agentMapByDialerId: Map<string, string>,
  integrationId: string,
  katalog: Katalog | null,
  aliasMap: Map<string, string>,
  udenKobling: Set<string>
) {
  let processed = 0
  let errors = 0
  let matched = 0
  const allCallsData: any[] = []
  for (const call of calls) {
    try {
      let agentId = agentMapByExtId.get(call.agentExternalId) ||
        agentMapByDialerId.get(call.agentExternalId) ||
        null
      if (!agentId && call.metadata) {
        const agentEmail = (call.metadata as any).agentEmail?.toLowerCase()
        if (agentEmail) {
          agentId = agentMapByEmail.get(agentEmail) || null
        }
      }
      // [F1a-3] Alias som data: samme medarbejder kan have flere eksterne bruger-id'er (agent_ekstern_alias, fyldt fra salg/UI)
      if (!agentId && call.agentExternalId) {
        agentId = aliasMap.get(`${kildeForIntegrationType(call.integrationType)}|${call.agentExternalId}`) || null
        if (!agentId) udenKobling.add(`${kildeForIntegrationType(call.integrationType)}|${call.agentExternalId}`)
      }
      if (agentId) matched++
      const raa = {
        external_id: call.externalId,
        integration_type: call.integrationType,
        dialer_name: call.dialerName,
        start_time: call.startTime,
        end_time: call.endTime,
        duration_seconds: call.durationSeconds,
        total_duration_seconds: call.totalDurationSeconds,
        status: call.status,
        agent_external_id: call.agentExternalId,
        campaign_external_id: call.campaignExternalId,
        lead_external_id: call.leadExternalId,
        agent_id: agentId,
        // Privacy: recording links are never stored. The agent e-mail from the payload
        // is still used above to resolve agent_id, it is just not persisted.
        recording_url: null,
        metadata: call.metadata ?? null,
        integration_id: integrationId,
        updated_at: new Date().toISOString(),
      }
      // [F1b-2] Feltkataloget afgør, hvad der skrives (kolonner og metadata-nøgler); recording_url forbliver null uanset katalog.
      // Fallback uden katalog (utilgængeligt eller uden rækker for kilden): kode-allowlisten som hidtil (dialer-call-privacy.ts).
      const kilde = kildeForIntegrationType(call.integrationType)
      const callData: Record<string, unknown> = katalog && harKilde(katalog, kilde)
        ? { ...anvendKatalog(katalog, "dialer_calls", kilde, raa).raekke, recording_url: null }
        : { ...raa, metadata: sanitizeDialerCallMetadata(call.metadata) }
      // [F1a-3] Ingen tabt sælger: kan sælgeren ikke matches, udelades agent_id fra rækken, så en allerede sat agent_id bevares ved upsert
      // (PostgREST opdaterer kun de kolonner, der sendes). Nye rækker får null som før.
      if (!agentId) delete callData.agent_id
      allCallsData.push(callData)
      processed++
    } catch (e) {
      errors++
      const errMsg = e instanceof Error ? e.message : String(e)
      log("ERROR", `Error preparando llamada ${call.externalId}`, errMsg)
    }
  }
  try {
    // Ens nøgler pr. upsert-kald (PostgREST-krav): rækker med og uden agent_id sendes hver for sig
    const grupper = [allCallsData.filter((r) => "agent_id" in r), allCallsData.filter((r) => !("agent_id" in r))]
    for (const gruppe of grupper) {
      if (gruppe.length === 0) continue
      const { error: upsertError } = await supabase
        .from("dialer_calls")
        .upsert(gruppe, {
          onConflict: "external_id,integration_type,dialer_name",
          ignoreDuplicates: false,
        })
      if (upsertError) throw upsertError
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    log("ERROR", `Error en upsert bulk de llamadas`, errMsg)
    errors += calls.length
    processed = 0
    matched = 0
  }
  return { processed, errors, matched }
}

export async function processCalls(
  supabase: SupabaseClient,
  calls: StandardCall[],
  integrationId: string,
  batchSize: number,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  if (calls.length === 0) return { processed: 0, errors: 0, matched: 0 }
  
  // Filter out calls from excluded email domains
  const filteredCalls = calls.filter(call => {
    const agentEmail = (call.metadata as any)?.agentEmail
    return !isExcludedEmail(agentEmail)
  })
  const skippedByDomain = calls.length - filteredCalls.length
  
  if (skippedByDomain > 0) {
    log("INFO", `Skipped ${skippedByDomain} calls from excluded email domains`)
  }
  
  if (filteredCalls.length === 0) return { processed: 0, errors: 0, matched: 0 }
  
  const sampleCall = filteredCalls[0]
  log(
    "INFO",
    `Procesando ${filteredCalls.length} llamadas de ${sampleCall.dialerName} (${sampleCall.integrationType}) en lotes de ${batchSize}...`
  )
  const agents = await fetchAllPaginated(supabase, "agents", "id, external_adversus_id, external_dialer_id, email", (q) => q);
  const agentMapByExtId = new Map<string, string>(
    agents.filter((a: any) => a.external_adversus_id && a.id).map((a: any) => [a.external_adversus_id, a.id])
  )
  const agentMapByDialerId = new Map<string, string>(
    agents.filter((a: any) => a.external_dialer_id && a.id).map((a: any) => [a.external_dialer_id, a.id])
  )
  const agentMapByEmail = new Map<string, string>(
    agents.filter((a: any) => a.email && a.id).map((a: any) => [a.email.toLowerCase(), a.id])
  )
  // [F1b-2] Kataloget hentes én gang pr. kørsel (cache 5 min). Fejl → fallback til kode-allowlisten med advarsel (Tier 1 må ikke stoppe).
  let katalog: Katalog | null = null
  try { katalog = await hentKatalog(supabase) } catch (e) { log("WARN", `feltkatalog utilgængeligt – kode-allowlist bruges: ${e instanceof Error ? e.message : String(e)}`) }
  // [F1a-3] Sælger-alias (eksternt bruger-id → agent) – data fra salg/UI; ukendte id'er registreres som »uden kobling« til UI'et
  const aliasMap = new Map<string, string>()
  try {
    const { data: aliaser, error } = await supabase.from("agent_ekstern_alias").select("kilde, ekstern_id, agent_id").not("agent_id", "is", null)
    if (error) throw error
    for (const a of (aliaser ?? []) as { kilde: string; ekstern_id: string; agent_id: string }[]) aliasMap.set(`${a.kilde}|${a.ekstern_id}`, a.agent_id)
  } catch (e) { log("WARN", `agent_ekstern_alias utilgængelig: ${e instanceof Error ? e.message : String(e)}`) }
  const udenKobling = new Set<string>()
  // [F1a-3] Kontoen (Integrationer-siden), så ukendte id'er kan vises på den rigtige konto; valgfri
  let kontoId: string | null = null
  try { const { data: k } = await supabase.from("api_konto").select("id").eq("integration_id", integrationId).maybeSingle(); kontoId = (k as { id?: string } | null)?.id ?? null } catch { kontoId = null }
  let totalProcessed = 0
  let totalErrors = 0
  let totalMatched = 0
  const batches = chunk(filteredCalls, batchSize)
  const totalBatches = batches.length
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batch = batches[batchNum]
    log("INFO", `Procesando lote de llamadas ${batchNum + 1}/${totalBatches} (${batch.length} llamadas)...`)
    const { processed, errors, matched } = await processCallsBatch(
      supabase,
      batch,
      agentMapByExtId,
      agentMapByEmail,
      log,
      agentMapByDialerId,
      integrationId,
      katalog,
      aliasMap,
      udenKobling
    )
    totalProcessed += processed
    totalErrors += errors
    totalMatched += matched
    log("INFO", `Lote ${batchNum + 1} completado: ${processed} procesadas, ${matched} matched, ${errors} errores`)
  }
  // [F1a-3] Ukendte sælger-id'er registreres (agent_id null) – vises i UI som »Sælgere uden kobling«; eksisterende rækker røres ikke
  if (udenKobling.size > 0) {
    const raekker = [...udenKobling].map((k) => { const [kilde, ekstern_id] = k.split("|"); return { kilde, ekstern_id, oprindelse: "kald", konto_id: kontoId } })
    const { error } = await supabase.from("agent_ekstern_alias").upsert(raekker, { onConflict: "kilde,ekstern_id", ignoreDuplicates: true })
    if (error) log("WARN", `agent_ekstern_alias: kunne ikke registrere ${raekker.length} ukendte sælger-id'er: ${error.message}`)
    else log("INFO", `${raekker.length} sælger-id'er uden kobling registreret (agent_ekstern_alias)`)
  }
  return { processed: totalProcessed, errors: totalErrors, matched: totalMatched }
}
